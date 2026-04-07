import admin from '../config/firebase.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import NotificationToken from '../models/notificationTokenModel.js';

/**
 * Calculates current TTL for timer notifications.
 * @param {string|number} endTime 
 * @returns {number} TTL in seconds
 */
const getTimerTTL = (endTime) => {
  const endMs = Number(endTime);
  if (isNaN(endMs)) return 3600 * 24; // 24h default in seconds
  const remaining = endMs - Date.now();
  // Return remaining time in seconds, minimum 60 seconds
  return Math.max(Math.floor(remaining / 1000), 60);
};

export const sendNotification = async (notificationData) => {
  const { 
    title, 
    body, 
    audience, 
    userIds = [], 
    type = 'normal', 
    data = {}, 
    createdBy,
    isHighPriority = false 
  } = notificationData;

  // 1. Create a log entry in DB
  const notificationLog = await Notification.create({
    title,
    body,
    audience,
    userIds,
    type,
    data,
    isHighPriority: isHighPriority || type === 'timer',
    status: 'pending',
    createdBy: createdBy || 'system',
  });

  try {
    // 2. Fetch audience users
    let query = {};
    if (audience === 'premium' || audience === 'Premium') {
      query.isPremium = true;
    } else if (audience === 'free' || audience === 'Free') {
      query.isPremium = false;
    } else if (audience === 'custom' && userIds.length > 0) {
      query._id = { $in: userIds };
    }

    // 3. Collect active FCM tokens
    // Note: We use User.fcmToken as primary, but could fallback to NotificationToken model
    const users = await User.find(query).select('fcmToken _id').lean();
    let tokens = users
      .map(u => u.fcmToken)
      .filter(t => t && t.length > 0);

    // If User collection has no tokens, try the dedicated NotificationToken model
    if (tokens.length === 0 && (audience === 'all' || audience === 'custom')) {
      const tokenDocs = audience === 'all' 
        ? await NotificationToken.find({}).lean()
        : await NotificationToken.find({ userId: { $in: userIds } }).lean();
      tokens = tokenDocs.map(d => d.deviceToken).filter(t => t);
    }

    if (tokens.length === 0) {
      notificationLog.status = 'sent';
      notificationLog.sentAt = new Date();
      await notificationLog.save();
      return { success: true, message: 'No users found with valid FCM tokens' };
    }

    // Update log to 'sending'
    notificationLog.status = 'sending';
    await notificationLog.save();

    // 4. Prepare Payload
    const stringifiedData = {};
    if (data) {
      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
          stringifiedData[key] = String(data[key]);
        }
      });
    }

    // Special requirements: high priority and data-only for background handlers
    const isDataOnly = ['timer', 'live', 'full_screen'].includes(type);
    const forceHighPriority = isHighPriority || isDataOnly;
    const ttl = isDataOnly && data.endTime ? getTimerTTL(data.endTime) : (3600 * 24);

    const messageTemplate = {
      data: {
        ...stringifiedData,
        title, // Ensure text is present in data block for data-only messages
        body,
        type,
        click_action: "OPEN_APP",
      },
      android: {
        priority: forceHighPriority ? 'high' : 'normal',
        ttl: ttl,
        // Carry data explicitly in android block for background handlers
        data: {
          ...stringifiedData, // type is spread from stringifiedData but overridden below
          title,
          body,
          type,
        }
      },
      apns: {
        payload: {
          ...stringifiedData,
          title,
          body,
          type,
          aps: isDataOnly ? {
            'content-available': 1 // Silent/Background push for timer handlers
          } : {
            alert: { title, body },
            sound: 'default',
            badge: 1,
          }
        },
        headers: {
          'apns-priority': forceHighPriority ? '10' : '5',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl)
        }
      }
    };

    // Standard notification title/body (only if not data-only)
    if (!isDataOnly) {
      messageTemplate.notification = {
        title,
        body,
        ...(data?.imageUrl ? { imageUrl: data.imageUrl } : {}),
      };
    }

    // 5. Firebase Messaging Multicast
    const CHUNK_SIZE = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    let invalidTokens = [];

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        ...messageTemplate,
      });

      totalSuccess += response.successCount;
      totalFailed += response.failureCount;

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

    // 6. Cleanup invalid tokens
    if (invalidTokens.length > 0) {
      await User.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { $unset: { fcmToken: 1 } }
      );
      await NotificationToken.deleteMany({ deviceToken: { $in: invalidTokens } });
    }

    // 7. Final Log Update
    notificationLog.status = 'sent';
    notificationLog.sentAt = new Date();
    notificationLog.recipientCount = totalSuccess; // Update our custom field
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
