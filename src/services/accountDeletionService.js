import {storage} from '../storage/index.js';
import Like from '../models/Like.js';
import Pass from '../models/Pass.js';
import Match from '../models/Match.js';
import Message from '../models/Message.js';
import Block from '../models/Block.js';
import Boost from '../models/Boost.js';
import ProfileComment from '../models/ProfileComment.js';
import DailyLikeCount from '../models/DailyLikeCount.js';
import {unregisterToken} from '../models/notificationTokenModel.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import GiftTransaction from '../models/GiftTransaction.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import PhotoInteraction from '../models/PhotoInteraction.js';
import IcebreakerInteraction from '../models/IcebreakerInteraction.js';
import Streak from '../modules/streak/streak.model.js';

/**
 * Perform an industry-standard thorough deletion of all user data.
 * This includes photos, messages, matches, likes, passes, and account records.
 */
export async function performThoroughAccountDeletion(userId) {
  console.log(
    `[AccountDeletion] Starting thorough deletion for user: ${userId}`,
  );

  try {
    // 1. Get profile to find all media URLs
    const profile = await Profile.findOne({userId});

    // 2. Delete all profile media from storage
    if (profile?.media?.media) {
      for (const item of profile.media.media) {
        if (item.url) {
          await deleteMediaFromUrl(item.url);
        }
      }
    }

    // 3. Delete message media (if any)
    const messagesWithMedia = await Message.find({
      $or: [{senderId: userId}, {receiverId: userId}],
      mediaUrl: {$ne: null},
    });

    for (const msg of messagesWithMedia) {
      if (msg.mediaUrl) {
        await deleteMediaFromUrl(msg.mediaUrl);
      }
    }

    // 4. Delete all interactions, wallet, gifts, streaks, reports & notifications
    await Promise.all([
      Like.deleteMany({$or: [{senderId: userId}, {receiverId: userId}]}),
      Pass.deleteMany({$or: [{userId: userId}, {passedUserId: userId}]}),
      Block.deleteMany({$or: [{blockerId: userId}, {blockedId: userId}]}),
      ProfileComment.deleteMany({
        $or: [{senderId: userId}, {receiverId: userId}],
      }),
      Boost.deleteMany({userId}),
      DailyLikeCount.deleteMany({userId}),
      Wallet.deleteMany({userId}),
      GiftTransaction.deleteMany({$or: [{senderId: userId}, {receiverId: userId}]}),
      Report.deleteMany({$or: [{reporterId: userId}, {reportedId: userId}, {reportedUserId: userId}]}),
      Notification.deleteMany({$or: [{userId}, {targetUserId: userId}]}),
      PhotoInteraction.deleteMany({$or: [{userId}, {targetUserId: userId}]}),
      IcebreakerInteraction.deleteMany({$or: [{userId}, {targetUserId: userId}]}),
      Streak.deleteMany({users: userId}),
      unregisterToken(userId),
    ]);

    // 5. Delete Chats and Matches
    // Note: We might want to notify the other user that the account was deleted
    // For now, we delete the matches and all associated messages
    const matches = await Match.find({users: userId});
    const matchIds = matches.map(m => m._id || m.id);

    await Promise.all([
      Message.deleteMany({matchId: {$in: matchIds}}),
      Match.deleteMany({users: userId}),
    ]);

    // 6. Delete Subscriptions from MongoDB
    try {
      const {default: SubscriptionModel} = await import('../models/Subscription.js');
      await SubscriptionModel.deleteMany({userId});
    } catch (e) {
      console.warn(
        '[AccountDeletion] Failed to cleanup subscriptions',
        e.message,
      );
    }

    // 7. Finally delete the core account records
    await Profile.deleteOne({userId});
    await User.findByIdAndDelete(userId);

    console.log(
      `[AccountDeletion] Successfully deleted all data for user: ${userId}`,
    );
    return {success: true};
  } catch (error) {
    console.error(
      `[AccountDeletion] Error during thorough deletion for ${userId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Helper to extract path from URL and delete from storage
 */
async function deleteMediaFromUrl(url) {
  if (!url) return;

  try {
    let filePath = null;
    const urlObj = new URL(url);

    if (url.includes('/api/files/') || url.includes('/uploads/')) {
      // Local storage URL
      filePath = urlObj.pathname.replace(/^\/(api\/files|uploads)\//, '');
    } else {
      // R2 or other public URL - usually the key is the pathname
      filePath = urlObj.pathname.replace(/^\//, '');

      // If it's a known bucket path like profiles/
      const profilesIndex = filePath.indexOf('profiles/');
      if (profilesIndex !== -1) {
        filePath = filePath.substring(profilesIndex);
      }
    }

    if (filePath) {
      await storage.deleteObject(filePath);
      console.log(`[AccountDeletion] Deleted storage object: ${filePath}`);
    }
  } catch (error) {
    console.warn(
      `[AccountDeletion] Could not delete media: ${url}`,
      error.message,
    );
  }
}
