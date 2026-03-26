import Like from '../models/Like.js';
import Match from '../models/Match.js';
import Pass from '../models/Pass.js';
import DailyLikeCount from '../models/DailyLikeCount.js';
import {sendPushNotification} from '../services/pushService.js';
import {
  sendMatchEmail,
  sendLikeEmail,
} from '../services/emailNotificationService.js';
import {isUserPremium} from '../models/Subscription.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import eventEmitter from '../modules/streak/eventEmitter.js';
import { resolveDisplayName } from '../utils/nameUtils.js';

// Helper to get profile name
async function getProfileName(userId) {
  try {
    const [profile, user] = await Promise.all([
      Profile.findOne({userId}),
      User.findById(userId),
    ]);

    return resolveDisplayName(profile, user);
  } catch (error) {
    return 'Someone';
  }
}

// Helper to get profile info for notifications
async function getProfileInfo(userId) {
  try {
    const [profile, user] = await Promise.all([
      Profile.findOne({userId}),
      User.findById(userId),
    ]);

    return {
      name: resolveDisplayName(profile, user),
      photo: profile?.media?.media?.[0]?.url || profile?.photos?.[0] || null,
      email: user?.email || null,
    };
  } catch (error) {
    return {name: 'Someone', photo: null, email: null};
  }
}

// Configuration for premium features
// Set to false to require premium for seeing who liked you
const LIKES_VISIBLE_FREE = false; // Change to false when you want to monetize

// Daily like limit configuration
const DAILY_LIKE_LIMIT = 50; // Free tier limit
const PREMIUM_DAILY_LIKE_LIMIT = 999999; // Effectively unlimited for premium

// Helper to get today's date string (YYYY-MM-DD)
function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Helper to get or create daily like count
async function getDailyLikeCount(userId, isPremium = false) {
  const today = getTodayDateString();
  const limit = isPremium ? PREMIUM_DAILY_LIKE_LIMIT : DAILY_LIKE_LIMIT;

  let dailyCount = await DailyLikeCount.findOne({userId, date: today});

  if (!dailyCount) {
    // Check if there's an old entry and reset if needed
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    dailyCount = await DailyLikeCount.create({
      userId,
      date: today,
      count: 0,
      lastResetAt: new Date(),
    });
  }

  return {
    count: dailyCount.count,
    limit,
    remaining: Math.max(0, limit - dailyCount.count),
    isPremium,
  };
}

// Helper to increment daily like count
async function incrementDailyLikeCount(userId) {
  const today = getTodayDateString();

  const dailyCount = await DailyLikeCount.findOneAndUpdate(
    {userId, date: today},
    {$inc: {count: 1}, lastResetAt: new Date()},
    {upsert: true, returnDocument: 'after'},
  );

  return dailyCount.count;
}

export const likeUser = async (req, res) => {
  try {
    const {senderId, receiverId, likedContent} = req.body;

    // Check premium status from subscription model
    const isPremium = await isUserPremium(senderId);

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: 'senderId and receiverId are required',
      });
    }

    // Check daily like limit
    const dailyLikeInfo = await getDailyLikeCount(senderId, isPremium);
    if (dailyLikeInfo.remaining <= 0) {
      return res.status(429).json({
        success: false,
        message: `You've reached your daily like limit of ${dailyLikeInfo.limit}. Come back tomorrow!`,
        limitReached: true,
        dailyLikeInfo,
      });
    }

    // Check if THIS SPECIFIC content is already liked
    let query = { senderId, receiverId };
    if (likedContent?.photoUrl) {
      query['likedContent.photoUrl'] = likedContent.photoUrl;
    } else {
      // General profile like check (no photoUrl)
      query['likedContent.photoUrl'] = { $exists: false };
    }

    const existingLike = await Like.findOne(query);
    
    if (existingLike) {
      // Toggle off (Unlike) this specific photo or profile like
      await Like.deleteOne({ _id: existingLike._id });
      return res.json({
        success: true,
        liked: false,
        message: 'Unliked successfully',
        dailyLikeInfo,
      });
    }

    // Prepare like data with optional likedContent
    const likeData = {senderId, receiverId};
    if (likedContent) {
      likeData.likedContent = {
        type: likedContent.type || 'profile',
        photoIndex: likedContent.photoIndex,
        photoUrl: likedContent.photoUrl,
        promptId: likedContent.promptId,
        promptQuestion: likedContent.promptQuestion,
        promptAnswer: likedContent.promptAnswer,
        comment: likedContent.comment
          ? likedContent.comment.slice(0, 200)
          : undefined,
      };
    }

    // Save like
    await Like.create(likeData);

    // Increment daily like count
    const newCount = await incrementDailyLikeCount(senderId);
    const updatedDailyLikeInfo = {
      ...dailyLikeInfo,
      count: newCount,
      remaining: Math.max(0, dailyLikeInfo.limit - newCount),
    };

    // Check for mutual like
    const reverseLike = await Like.findOne({
      senderId: receiverId,
      receiverId: senderId,
    });

    if (reverseLike) {
      // It's a match!
      // Check if match already exists
      let match = await Match.findOne({
        users: {$all: [senderId, receiverId]},
      });

      if (!match) {
        match = await Match.create({
          users: [senderId, receiverId],
        });
      } else {
        // If it existing, re-enable chat in case they were unmatched before
        if (!match.chatEnabled || match.status !== 'active') {
          match.chatEnabled = true;
          match.status = 'active';
          await match.save();
          console.log(`[Re-Match Fix] Re-enabled chat for match: ${match._id}`);
        }
      }

      // Get profile info for both users (for notifications)
      const senderInfo = await getProfileInfo(senderId);
      const receiverInfo = await getProfileInfo(receiverId);

      // Send push notification about the match to both users
      sendPushNotification(senderId, {
        title: "It's a Match! 🎉",
        body: `You and ${receiverInfo.name} liked each other!`,
        data: {
          type: 'match',
          matchId: match._id.toString(),
          userId: receiverId,
        },
      }).catch(err => console.error('Push error:', err));

      sendPushNotification(receiverId, {
        title: "It's a Match! 🎉",
        body: `You and ${senderInfo.name} liked each other!`,
        data: {
          type: 'match',
          matchId: match._id.toString(),
          userId: senderId,
        },
      }).catch(err => console.error('Push error:', err));

      // Send email notifications for match to both users
      if (senderInfo.email) {
        sendMatchEmail(
          senderInfo.email,
          receiverInfo.name,
          receiverInfo.photo,
        ).catch(err => console.error('Match email error:', err));
      }
      if (receiverInfo.email) {
        sendMatchEmail(
          receiverInfo.email,
          senderInfo.name,
          senderInfo.photo,
        ).catch(err => console.error('Match email error:', err));
      }

      // 🔥 Streak: mutual like = both users interacted → treat as 'match'
      eventEmitter.emit('activity:engagement', {
        fromUser: senderId,
        toUser: receiverId,
        type: 'match',
      });

      return res.json({
        success: true,
        liked: true,
        isMatch: true,
        match,
        dailyLikeInfo: updatedDailyLikeInfo,
      });
    }

    // 🔥 Streak: one-sided like — record this user's participation flag
    eventEmitter.emit('activity:engagement', {
      fromUser: senderId,
      toUser: receiverId,
      type: 'like',
    });
    // Not a match yet - send "someone liked you" notification to receiver
    const senderInfo = await getProfileInfo(senderId);
    const receiverInfo = await getProfileInfo(receiverId);

    sendPushNotification(receiverId, {
      title: 'Someone likes you! 💕',
      body: LIKES_VISIBLE_FREE
        ? `${senderInfo.name} liked your profile!`
        : 'Someone new liked your profile! Open the app to see who.',
      data: {
        type: 'like',
        senderId: LIKES_VISIBLE_FREE ? senderId : 'hidden',
      },
    }).catch(err => console.error('Push error:', err));

    // Send email notification for like
    if (receiverInfo.email) {
      sendLikeEmail(
        receiverInfo.email,
        senderInfo.name,
        senderInfo.photo,
        LIKES_VISIBLE_FREE,
      ).catch(err => console.error('Like email error:', err));
    }

    res.json({
      success: true,
      liked: true,
      isMatch: false,
      dailyLikeInfo: updatedDailyLikeInfo,
    });
  } catch (error) {
    console.error('Error liking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error liking user',
      error: error.message,
    });
  }
};

// Get users who liked the current user
export const getLikesReceived = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Check premium status from subscription model
    const isPremium = (await isUserPremium(userId)) || LIKES_VISIBLE_FREE;

    // Get all likes where this user is the receiver AND it is a profile right-swipe (not a photo like)
    const likes = await Like.find({
      receiverId: userId,
      $or: [
        { likedContent: { $exists: false } },
        { 'likedContent.type': 'profile' }
      ]
    }).sort({createdAt: -1});

    // Check which ones are already matched
    const matches = await Match.find({users: userId});
    const matchedUserIds = matches.map(m => m.users.find(id => id !== userId));

    // Filter out already matched users (they're in matches now)
    const pendingLikes = likes.filter(
      l => !matchedUserIds.includes(l.senderId),
    );

    if (!isPremium && !LIKES_VISIBLE_FREE) {
      // Return count only for non-premium users
      return res.json({
        success: true,
        count: pendingLikes.length,
        likes: [],
        isPremiumRequired: true,
        message: 'Upgrade to Premium to see who liked you!',
      });
    }

    // Get profile and user info for each liker
    const likerIds = pendingLikes.map(l => l.senderId);
    const [profiles, users] = await Promise.all([
      Profile.find({userId: {$in: likerIds}}),
      User.find({_id: {$in: likerIds}}),
    ]);

    const likesWithProfiles = pendingLikes.map(like => {
      const profile = profiles.find(p => p.userId === like.senderId);
      const user = users.find(u => u._id === like.senderId);

      return {
        _id: like._id,
        senderId: like.senderId,
        likedAt: like.createdAt,
        userId: like.senderId,
        name: resolveDisplayName(profile, user),
        age: profile?.personalDetails?.age || profile?.basicInfo?.age || null,
        photo: profile?.media?.media?.[0]?.url || profile?.photos?.[0] || null,
        comment: like.likedContent?.comment,
      };
    });

    res.json({
      success: true,
      count: likesWithProfiles.length,
      likes: likesWithProfiles,
      isPremiumRequired: false,
    });
  } catch (error) {
    console.error('Error getting likes received:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting likes',
      error: error.message,
    });
  }
};

// Get count of users who liked the current user (for badge display)
export const getLikesCount = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Get all profile right-swipes where this user is the receiver
    const likes = await Like.find({
      receiverId: userId,
      $or: [
        { likedContent: { $exists: false } },
        { 'likedContent.type': 'profile' }
      ]
    });

    // Check which ones are already matched
    let pendingCount = 0;
    for (const like of likes) {
      const mutualLike = await Like.findOne({
        senderId: userId,
        receiverId: like.senderId,
      });
      if (!mutualLike) {
        pendingCount++;
      }
    }

    res.json({
      success: true,
      count: pendingCount,
    });
  } catch (error) {
    console.error('Error getting likes count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting likes count',
      error: error.message,
    });
  }
};

// Get daily like count and remaining likes for a user
export const getDailyLikeInfo = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Check premium status from subscription model
    const isPremium = await isUserPremium(userId);
    const dailyLikeInfo = await getDailyLikeCount(userId, isPremium);

    res.json({
      success: true,
      ...dailyLikeInfo,
    });
  } catch (error) {
    console.error('Error getting daily like info:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting daily like info',
      error: error.message,
    });
  }
};

// Check if a viewer has liked a target user
export const getLikedStatus = async (req, res) => {
  console.log(`[LikeController] getLikedStatus - viewerId: ${req.params.viewerId}, targetId: ${req.params.targetId}`);
  try {
    const { viewerId, targetId } = req.params;

    if (!viewerId || !targetId) {
      return res.status(400).json({ 
        success: false, 
        message: 'viewerId and targetId are required' 
      });
    }

    // Find ALL likes from this viewer to this target (supports multiple photos)
    const existingLikes = await Like.find({ senderId: viewerId, receiverId: targetId }).lean();
    
    const likedItems = existingLikes.map(like => {
      return like.likedContent?.photoUrl ? { type: 'photo', photoUrl: like.likedContent.photoUrl } : { type: 'profile' };
    });

    res.json({
      success: true,
      liked: existingLikes.length > 0,
      likedItems: likedItems, // Return all liked items
      likedContent: existingLikes.length > 0 ? existingLikes[0].likedContent : null // Kept for backwards compatibility
    });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking like status',
      error: error.message
    });
  }
};
