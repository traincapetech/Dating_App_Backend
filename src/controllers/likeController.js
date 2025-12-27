import Like from "../models/Like.js";   
import Match from "../models/Match.js";
import Pass from "../models/Pass.js";
import DailyLikeCount from "../models/DailyLikeCount.js";
import { sendPushNotification } from "../services/pushService.js";
import { storage } from "../storage/index.js";

const PROFILES_PATH = 'data/profiles.json';

// Helper to get profile name
async function getProfileName(userId) {
  try {
    const profiles = await storage.readJson(PROFILES_PATH, []);
    const profile = profiles.find(p => p.userId === userId);
    return profile?.basicInfo?.firstName || profile?.name || 'Someone';
  } catch (error) {
    return 'Someone';
  }
}

// Configuration for premium features
// Set to false to require premium for seeing who liked you
const LIKES_VISIBLE_FREE = true; // Change to false when you want to monetize

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
  
  let dailyCount = await DailyLikeCount.findOne({ userId, date: today });
  
  if (!dailyCount) {
    // Check if there's an old entry and reset if needed
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    dailyCount = await DailyLikeCount.create({
      userId,
      date: today,
      count: 0,
      lastResetAt: new Date()
    });
  }
  
  return {
    count: dailyCount.count,
    limit,
    remaining: Math.max(0, limit - dailyCount.count),
    isPremium
  };
}

// Helper to increment daily like count
async function incrementDailyLikeCount(userId) {
  const today = getTodayDateString();
  
  const dailyCount = await DailyLikeCount.findOneAndUpdate(
    { userId, date: today },
    { $inc: { count: 1 }, lastResetAt: new Date() },
    { upsert: true, new: true }
  );
  
  return dailyCount.count;
}

export const likeUser = async (req, res) => {
  try {
    const { senderId, receiverId, isPremium = false } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({ success: false, message: "senderId and receiverId are required" });
    }

    // Check daily like limit
    const dailyLikeInfo = await getDailyLikeCount(senderId, isPremium);
    if (dailyLikeInfo.remaining <= 0) {
      return res.status(429).json({ 
        success: false, 
        message: `You've reached your daily like limit of ${dailyLikeInfo.limit}. Come back tomorrow!`,
        limitReached: true,
        dailyLikeInfo
      });
    }

    // Check if already liked
    const existingLike = await Like.findOne({ senderId, receiverId });
    if (existingLike) {
      return res.json({ success: true, isMatch: false, alreadyLiked: true, dailyLikeInfo });
    }

    // Save like
    await Like.create({ senderId, receiverId });
    
    // Increment daily like count
    const newCount = await incrementDailyLikeCount(senderId);
    const updatedDailyLikeInfo = {
      ...dailyLikeInfo,
      count: newCount,
      remaining: Math.max(0, dailyLikeInfo.limit - newCount)
    };

    // Check for mutual like
    const reverseLike = await Like.findOne({
      senderId: receiverId,
      receiverId: senderId
    });

    if (reverseLike) {
      // It's a match!
      const match = await Match.create({
        users: [senderId, receiverId]
      });

      // Send push notification about the match to both users
      const senderName = await getProfileName(senderId);
      const receiverName = await getProfileName(receiverId);

      // Notify User A (sender) about the match
      sendPushNotification(senderId, {
        title: "It's a Match! 🎉",
        body: `You and ${receiverName} liked each other!`,
        data: {
          type: 'match',
          matchId: match._id.toString(),
          userId: receiverId
        }
      }).catch(err => console.error('Push error:', err));

      // Notify User B (receiver) about the match
      sendPushNotification(receiverId, {
        title: "It's a Match! 🎉",
        body: `You and ${senderName} liked each other!`,
        data: {
          type: 'match',
          matchId: match._id.toString(),
          userId: senderId
        }
      }).catch(err => console.error('Push error:', err));

      return res.json({
        success: true,
        isMatch: true,
        match,
        dailyLikeInfo: updatedDailyLikeInfo
      });
    }

    // Not a match yet - send "someone liked you" notification to receiver
    const senderName = await getProfileName(senderId);
    
    sendPushNotification(receiverId, {
      title: "Someone likes you! 💕",
      body: LIKES_VISIBLE_FREE 
        ? `${senderName} liked your profile!` 
        : "Someone new liked your profile! Open the app to see who.",
      data: {
        type: 'like',
        senderId: LIKES_VISIBLE_FREE ? senderId : 'hidden'
      }
    }).catch(err => console.error('Push error:', err));

    res.json({ success: true, isMatch: false, dailyLikeInfo: updatedDailyLikeInfo });

  } catch (error) {
    console.error("Error liking user:", error);
    res.status(500).json({ success: false, message: "Error liking user", error: error.message });
  }
};

// Get users who liked the current user
export const getLikesReceived = async (req, res) => {
  try {
    const { userId } = req.params;
    const isPremium = req.query.isPremium === 'true' || LIKES_VISIBLE_FREE;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    // Get all likes where this user is the receiver
    const likes = await Like.find({ receiverId: userId }).sort({ createdAt: -1 });

    // Check which ones are already matched (mutual likes)
    const matchedUserIds = [];
    for (const like of likes) {
      const mutualLike = await Like.findOne({
        senderId: userId,
        receiverId: like.senderId
      });
      if (mutualLike) {
        matchedUserIds.push(like.senderId);
      }
    }

    // Filter out already matched users (they're in matches now)
    const pendingLikes = likes.filter(l => !matchedUserIds.includes(l.senderId));

    if (!isPremium && !LIKES_VISIBLE_FREE) {
      // Return count only for non-premium users
      return res.json({
        success: true,
        count: pendingLikes.length,
        likes: [],
        isPremiumRequired: true,
        message: "Upgrade to Premium to see who liked you!"
      });
    }

    // Get profile info for each liker
    const profiles = await storage.readJson(PROFILES_PATH, []);
    
    const likesWithProfiles = pendingLikes.map(like => {
      const profile = profiles.find(p => p.userId === like.senderId);
      return {
        oderId: like.senderId,
        odedAt: like.createdAt,
        userId: like.senderId,
        likedAt: like.createdAt,
        name: profile?.basicInfo?.firstName || profile?.name || 'Unknown',
        age: profile?.personalDetails?.age || profile?.basicInfo?.age || null,
        photo: profile?.media?.media?.[0]?.url || profile?.photos?.[0] || null,
      };
    });

    res.json({
      success: true,
      count: likesWithProfiles.length,
      likes: likesWithProfiles,
      isPremiumRequired: false
    });

  } catch (error) {
    console.error("Error getting likes received:", error);
    res.status(500).json({ success: false, message: "Error getting likes", error: error.message });
  }
};

// Get count of users who liked the current user (for badge display)
export const getLikesCount = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    // Get all likes where this user is the receiver
    const likes = await Like.find({ receiverId: userId });

    // Check which ones are already matched
    let pendingCount = 0;
    for (const like of likes) {
      const mutualLike = await Like.findOne({
        senderId: userId,
        receiverId: like.senderId
      });
      if (!mutualLike) {
        pendingCount++;
      }
    }

    res.json({
      success: true,
      count: pendingCount
    });

  } catch (error) {
    console.error("Error getting likes count:", error);
    res.status(500).json({ success: false, message: "Error getting likes count", error: error.message });
  }
};

// Get daily like count and remaining likes for a user
export const getDailyLikeInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const isPremium = req.query.isPremium === 'true';

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const dailyLikeInfo = await getDailyLikeCount(userId, isPremium);
    
    res.json({
      success: true,
      ...dailyLikeInfo
    });

  } catch (error) {
    console.error("Error getting daily like info:", error);
    res.status(500).json({ success: false, message: "Error getting daily like info", error: error.message });
  }
};
