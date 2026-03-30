import admin from '../config/firebase.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import NotificationToken from '../models/notificationTokenModel.js';

export const sendNotification = async (notificationData) => {
  const { title, body, audience, userIds = [], type = 'normal', data = {}, createdBy } = notificationData;

  // 1. Create a log entry in DB
  const notificationLog = await Notification.create({
    title,
    body,
    audience,
    userIds,
    type,
    data,
    status: 'pending',
    createdBy: createdBy || 'system',
  });

  try {
    // 2. Fetch audience users
    let query = {};
    if (audience === 'premium') {
      query.isPremium = true;
    } else if (audience === 'free') {
      query.isPremium = false;
    } else if (audience === 'custom' && userIds.length > 0) {
      query._id = { $in: userIds };
    }

    // 3. Collect active FCM tokens
    const users = await User.find(query).select('fcmToken _id').lean();
    const tokens = users
      .map(u => u.fcmToken)
      .filter(t => t && t.length > 0);

    if (tokens.length === 0) {
      notificationLog.status = 'sent';
      notificationLog.sentAt = new Date();
      await notificationLog.save();
      return { success: true, message: 'No users found with valid FCM tokens' };
    }

    // Update log to 'sending'
    notificationLog.status = 'sending';
    await notificationLog.save();

    // 4. Firebase Messaging Payload
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        type, // e.g., 'persistent'
        click_action: "OPEN_APP",
      },
    };

    // FCM Multicast sends to multiple tokens efficiently
    // We chunk them because FCM supports up to 500 per sendMulticast call
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    let invalidTokens = [];

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        ...message,
      });

      totalSuccess += response.successCount;
      totalFailed += response.failureCount;

      // Handle invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(chunk[idx]);
          }
        }
      });
    }

    // 5. Cleanup invalid tokens in background
    if (invalidTokens.length > 0) {
      await User.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { $unset: { fcmToken: 1 } }
      );
      // Also cleanup NotificationToken model if used there
      await NotificationToken.deleteMany({ deviceToken: { $in: invalidTokens } });
    }

    // 6. Final Log Update
    notificationLog.status = 'sent';
    notificationLog.sentAt = new Date();
    notificationLog.stats = {
      totalSent: tokens.length,
      success: totalSuccess,
      failed: totalFailed,
    };
    await notificationLog.save();

    return { 
      success: true, 
      stats: notificationLog.stats 
    };

  } catch (error) {
    console.error('❌ FCM Service error:', error);
    notificationLog.status = 'failed';
    await notificationLog.save();
    throw error;
  }
};
