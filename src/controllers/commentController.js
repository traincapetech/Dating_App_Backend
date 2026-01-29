/**
 * Profile Comment Controller
 * Handles Hinge-style comments/icebreakers on profiles
 */

import ProfileComment from "../models/ProfileComment.js";
import Match from "../models/Match.js";
import { sendPushNotification } from "../services/pushService.js";
import { storage } from "../storage/index.js";
import { isUserPremium } from "../models/Subscription.js";

const PROFILES_PATH = 'data/profiles.json';

// Helper to get profile info
async function getProfileInfo(userId) {
  try {
    const profiles = await storage.readJson(PROFILES_PATH, []);
    const profile = profiles.find(p => p.userId === userId);
    const users = await storage.readJson('data/users.json', []);
    const user = users.find(u => u._id === userId || u.id === userId);
    
    return {
      name: profile?.basicInfo?.firstName || profile?.name || 'Someone',
      photo: profile?.media?.media?.[0]?.url || profile?.photos?.[0] || null,
      email: user?.email || null,
    };
  } catch (error) {
    return { name: 'Someone', photo: null, email: null };
  }
}

// Daily comment limit for free users
const DAILY_COMMENT_LIMIT = 10;
const PREMIUM_COMMENT_LIMIT = 100;

/**
 * Send a comment/icebreaker to another user
 */
export const sendComment = async (req, res) => {
  try {
    const { senderId, receiverId, comment, targetContent } = req.body;

    if (!senderId || !receiverId || !comment) {
      return res.status(400).json({
        success: false,
        message: "senderId, receiverId, and comment are required"
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment must be 500 characters or less"
      });
    }

    // Check if user is premium
    const isPremium = await isUserPremium(senderId);
    const dailyLimit = isPremium ? PREMIUM_COMMENT_LIMIT : DAILY_COMMENT_LIMIT;

    // Check daily comment limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayCommentCount = await ProfileComment.countDocuments({
      senderId,
      createdAt: { $gte: todayStart }
    });

    if (todayCommentCount >= dailyLimit) {
      return res.status(429).json({
        success: false,
        message: `You've reached your daily comment limit (${dailyLimit}). ${!isPremium ? 'Upgrade to Premium for more!' : 'Try again tomorrow!'}`,
        limitReached: true,
        isPremium
      });
    }

    // Check if already commented on this user (pending comment exists)
    const existingComment = await ProfileComment.findOne({
      senderId,
      receiverId,
      status: 'pending'
    });

    if (existingComment) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending comment for this user"
      });
    }

    // Create the comment
    const profileComment = await ProfileComment.create({
      senderId,
      receiverId,
      comment: comment.trim(),
      targetContent: targetContent || { type: 'profile' },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });

    // Send push notification to receiver
    const senderInfo = await getProfileInfo(senderId);
    
    sendPushNotification(receiverId, {
      title: "New Comment! 💬",
      body: `${senderInfo.name} left you a comment${targetContent?.type === 'photo' ? ' on your photo' : targetContent?.type === 'prompt' ? ' on your answer' : ''}`,
      data: {
        type: 'profile_comment',
        commentId: profileComment._id.toString(),
        senderId,
      }
    }).catch(err => console.error('Push notification error:', err));

    res.status(201).json({
      success: true,
      comment: profileComment,
      remainingComments: dailyLimit - todayCommentCount - 1
    });

  } catch (error) {
    console.error("Error sending comment:", error);
    res.status(500).json({
      success: false,
      message: "Error sending comment",
      error: error.message
    });
  }
};

/**
 * Get comments received by a user
 */
export const getReceivedComments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status = 'pending' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const comments = await ProfileComment.find({
      receiverId: userId,
      status: status === 'all' ? { $exists: true } : status
    }).sort({ createdAt: -1 });

    // Get profile info for each sender
    const profiles = await storage.readJson(PROFILES_PATH, []);
    
    const commentsWithProfiles = await Promise.all(comments.map(async (comment) => {
      const profile = profiles.find(p => p.userId === comment.senderId);
      return {
        ...comment.toObject(),
        senderProfile: {
          name: profile?.basicInfo?.firstName || profile?.name || 'Unknown',
          age: profile?.personalDetails?.age || profile?.basicInfo?.age || null,
          photo: profile?.media?.media?.[0]?.url || profile?.photos?.[0] || null,
        }
      };
    }));

    res.json({
      success: true,
      count: commentsWithProfiles.length,
      comments: commentsWithProfiles
    });

  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      message: "Error getting comments",
      error: error.message
    });
  }
};

/**
 * Get comments sent by a user
 */
export const getSentComments = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const comments = await ProfileComment.find({
      senderId: userId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: comments.length,
      comments
    });

  } catch (error) {
    console.error("Error getting sent comments:", error);
    res.status(500).json({
      success: false,
      message: "Error getting sent comments",
      error: error.message
    });
  }
};

/**
 * Respond to a comment (accept/reject)
 * Accepting a comment creates a match
 */
export const respondToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId, action } = req.body; // action: 'accept' or 'reject'

    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        message: "userId and action are required"
      });
    }

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'accept' or 'reject'"
      });
    }

    const comment = await ProfileComment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    if (comment.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only respond to comments sent to you"
      });
    }

    if (comment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Comment has already been ${comment.status}`
      });
    }

    // Update comment status
    comment.status = action === 'accept' ? 'accepted' : 'rejected';
    comment.respondedAt = new Date();
    await comment.save();

    let match = null;

    // If accepted, create a match
    if (action === 'accept') {
      match = await Match.create({
        users: [comment.senderId, comment.receiverId],
        initiatedBy: 'comment',
        commentId: comment._id
      });

      // Notify the sender
      const receiverInfo = await getProfileInfo(userId);
      
      sendPushNotification(comment.senderId, {
        title: "It's a Match! 🎉",
        body: `${receiverInfo.name} liked your comment! Start chatting now!`,
        data: {
          type: 'match',
          matchId: match._id.toString(),
          userId: userId
        }
      }).catch(err => console.error('Push notification error:', err));
    }

    res.json({
      success: true,
      action,
      comment,
      match,
      message: action === 'accept' ? "It's a match! You can now chat." : "Comment rejected"
    });

  } catch (error) {
    console.error("Error responding to comment:", error);
    res.status(500).json({
      success: false,
      message: "Error responding to comment",
      error: error.message
    });
  }
};

/**
 * Mark comment as read
 */
export const markCommentRead = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await ProfileComment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    if (comment.receiverId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only mark your own received comments as read"
      });
    }

    comment.isRead = true;
    await comment.save();

    res.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error("Error marking comment as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking comment as read",
      error: error.message
    });
  }
};

/**
 * Get unread comment count
 */
export const getUnreadCommentCount = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    const count = await ProfileComment.countDocuments({
      receiverId: userId,
      status: 'pending',
      isRead: false
    });

    res.json({
      success: true,
      count
    });

  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Error getting unread count",
      error: error.message
    });
  }
};

/**
 * Delete a sent comment (only if pending)
 */
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await ProfileComment.findById(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    if (comment.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own comments"
      });
    }

    if (comment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Can only delete pending comments"
      });
    }

    await ProfileComment.deleteOne({ _id: commentId });

    res.json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting comment",
      error: error.message
    });
  }
};

export default {
  sendComment,
  getReceivedComments,
  getSentComments,
  respondToComment,
  markCommentRead,
  getUnreadCommentCount,
  deleteComment,
};
