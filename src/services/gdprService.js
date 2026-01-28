import {findUserById, updateUser, getUsers} from '../models/userModel.js';
import {findProfileByUserId} from '../models/profileModel.js';
import {storage} from '../storage/index.js';

/**
 * GDPR Service - Handles data export, access, and deletion requests
 * Implements GDPR rights: access, portability, rectification, erasure
 */

/**
 * Export all user data (GDPR Right to Data Portability)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Complete user data export
 */
export async function exportUserData(userId) {
  try {
    const user = await findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const profile = await findProfileByUserId(userId);
    
    // Get all related data
    const [matches, messages, likes, passes, blocks, reports, subscriptions, notificationTokens] = await Promise.all([
      getCollectionData('matches', userId),
      getCollectionData('messages', userId),
      getCollectionData('likes', userId),
      getCollectionData('passes', userId),
      getCollectionData('blocks', userId),
      getCollectionData('reports', userId),
      getCollectionData('subscriptions', userId),
      getCollectionData('notificationTokens', userId),
    ]);

    // Compile complete data export
    const dataExport = {
      exportDate: new Date().toISOString(),
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        isPaused: user.isPaused,
      },
      profile: profile ? {
        basicInfo: profile.basicInfo,
        datingPreferences: profile.datingPreferences,
        personalDetails: profile.personalDetails,
        lifestyle: profile.lifestyle,
        profilePrompts: profile.profilePrompts,
        media: profile.media,
        location: profile.location,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      } : null,
      matches: matches,
      messages: messages.map(msg => ({
        id: msg.id,
        matchId: msg.matchId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content,
        type: msg.type,
        timestamp: msg.timestamp,
        status: msg.status,
      })),
      likes: {
        sent: likes.filter(like => like.likerId === userId),
        received: likes.filter(like => like.likedUserId === userId),
      },
      passes: passes.filter(pass => pass.passerId === userId),
      blocks: {
        blocked: blocks.filter(block => block.blockerId === userId),
        blockedBy: blocks.filter(block => block.blockedUserId === userId),
      },
      reports: {
        reported: reports.filter(report => report.reporterId === userId),
        reportedBy: reports.filter(report => report.reportedUserId === userId),
      },
      subscriptions: subscriptions.filter(sub => sub.userId === userId),
      notificationTokens: notificationTokens.filter(token => token.userId === userId),
      metadata: {
        totalMatches: matches.length,
        totalMessages: messages.length,
        totalLikesSent: likes.filter(like => like.likerId === userId).length,
        totalLikesReceived: likes.filter(like => like.likedUserId === userId).length,
        totalPasses: passes.length,
        totalBlocks: blocks.length,
        totalReports: reports.length,
        hasActiveSubscription: subscriptions.some(sub => sub.status === 'active'),
      },
    };

    return dataExport;
  } catch (error) {
    console.error('[GDPR Service] Error exporting user data:', error);
    throw error;
  }
}

/**
 * Get collection data related to user
 */
async function getCollectionData(collectionName, userId) {
  try {
    const filePath = `data/${collectionName}.json`;
    const data = await storage.readJson(filePath, []);
    
    // Filter data where user is involved
    return data.filter(item => {
      // Check common user ID fields
      if (item.userId === userId) return true;
      if (item.likerId === userId || item.likedUserId === userId) return true;
      if (item.passerId === userId || item.passedUserId === userId) return true;
      if (item.blockerId === userId || item.blockedUserId === userId) return true;
      if (item.reporterId === userId || item.reportedUserId === userId) return true;
      if (item.senderId === userId || item.receiverId === userId) return true;
      if (Array.isArray(item.users) && item.users.includes(userId)) return true;
      return false;
    });
  } catch (error) {
    // Collection might not exist, return empty array
    return [];
  }
}

/**
 * Schedule user data deletion (GDPR Right to Erasure)
 * Implements grace period for account recovery
 * @param {string} userId - User ID
 * @param {number} gracePeriodDays - Days before permanent deletion (default: 30)
 * @returns {Promise<Object>} Deletion schedule info
 */
export async function scheduleDataDeletion(userId, gracePeriodDays = 30) {
  try {
    const user = await findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

    // Mark user for deletion
    await updateUser(userId, {
      deletionScheduled: true,
      deletionScheduledAt: new Date().toISOString(),
      deletionDate: deletionDate.toISOString(),
      isPaused: true, // Pause profile during grace period
    });

    return {
      success: true,
      message: 'Data deletion scheduled successfully',
      deletionDate: deletionDate.toISOString(),
      gracePeriodDays,
      canCancelUntil: deletionDate.toISOString(),
    };
  } catch (error) {
    console.error('[GDPR Service] Error scheduling deletion:', error);
    throw error;
  }
}

/**
 * Cancel scheduled deletion
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cancellation result
 */
export async function cancelScheduledDeletion(userId) {
  try {
    const user = await findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.deletionScheduled) {
      return {
        success: false,
        message: 'No scheduled deletion found',
      };
    }

    await updateUser(userId, {
      deletionScheduled: false,
      deletionScheduledAt: null,
      deletionDate: null,
      isPaused: false, // Resume profile
    });

    return {
      success: true,
      message: 'Scheduled deletion cancelled successfully',
    };
  } catch (error) {
    console.error('[GDPR Service] Error cancelling deletion:', error);
    throw error;
  }
}

/**
 * Get users scheduled for deletion
 * @param {Date} beforeDate - Get users scheduled before this date
 * @returns {Promise<Array>} List of users to delete
 */
export async function getUsersScheduledForDeletion(beforeDate = new Date()) {
  try {
    const users = await getUsers();
    return users.filter(user => {
      if (!user.deletionScheduled || !user.deletionDate) return false;
      const deletionDate = new Date(user.deletionDate);
      return deletionDate <= beforeDate;
    });
  } catch (error) {
    console.error('[GDPR Service] Error getting scheduled deletions:', error);
    return [];
  }
}

