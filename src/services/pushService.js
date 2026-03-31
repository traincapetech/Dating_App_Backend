import firebaseAdmin from '../config/firebase.js';
import { findTokenByUserId, unregisterToken } from '../models/notificationTokenModel.js';

/**
 * Calculate seconds-to-live for a notification.
 * 
 * For timer notifications the TTL is capped to the remaining time before the 
 * endTime so that expired countdown pushes are never delivered.
 * For all other types we fall back to 24 hours.
 * 
 * @param {'timer'|'general'|string} type 
 * @param {string|number|undefined} endTime  Unix timestamp in milliseconds
 * @returns {number} TTL in seconds
 */
function resolveTtlSeconds(type, endTime) {
  const DEFAULT_TTL = 3600 * 24; // 24 h

  if (type === 'timer' && endTime) {
    const endMs = Number(endTime);
    if (!isNaN(endMs) && endMs > Date.now()) {
      const remainingSeconds = Math.floor((endMs - Date.now()) / 1000);
      // Minimum 60 s so the notification isn't dropped immediately
      return Math.max(remainingSeconds, 60);
    }
    // endTime is in the past – discard by setting TTL to 0
    return 0;
  }

  return DEFAULT_TTL;
}

/**
 * Serialize a data object so every value is a string, as FCM requires.
 * @param {Record<string,any>} data 
 * @returns {Record<string,string>}
 */
function serializeData(data) {
  if (!data || typeof data !== 'object') return {};
  const serialized = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      serialized[k] = String(v);
    }
  });
  return serialized;
}

/**
 * Build an FCM message object according to the new timer push specifications.
 * 
 * Timer-type notifications use a *data-only* strategy so Android / iOS 
 * background handlers receive the payload even when the app is closed.
 * The `android.data` + `apns.payload` fields carry the data block explicitly
 * to satisfy FCM background delivery requirements.
 * 
 * @param {string} deviceToken 
 * @param {object} notification 
 * @param {string} notification.title
 * @param {string} notification.body
 * @param {'timer'|'general'|string} [notification.type]
 * @param {boolean} [notification.isHighPriority]
 * @param {boolean} [notification.isDataOnly]
 * @param {object}  [notification.data]
 * @returns {object} FCM message
 */
function buildMessage(deviceToken, notification) {
  const {
    title,
    body,
    type = 'general',
    isHighPriority = false,
    isDataOnly = false,
    data = {},
  } = notification;

  const serializedData = serializeData(data);
  const ttl = resolveTtlSeconds(type, data?.endTime);

  // For timer notifications we always force data-only delivery so the 
  // background handler can render the countdown itself.
  const forceDataOnly = type === 'timer' || isDataOnly;
  const priority = isHighPriority || type === 'timer' ? 'high' : 'normal';

  const message = {
    token: deviceToken,
    // Top-level data block – always present for background wake-up
    data: {
      ...serializedData,
      title, // Include title and body so the frontend can display them 
      body,  // even when it's a data-only message.
      type, // Ensure type is present in data block for client-side routing
    },
  };

  // ---- Visible notification (non-data-only flows) ----
  if (!forceDataOnly) {
    message.notification = { title, body };
  }

  // ---- Android config ----
  message.android = {
    priority,
    ttl: ttl * 1000, // FCM expects milliseconds for android.ttl
    // Include the data object explicitly at the android level for reliability
    data: {
      ...serializedData,
      title,
      body,
      type,
    },
  };

  if (!forceDataOnly) {
    message.android.notification = {
      channelId: type === 'timer' ? 'timer_priority' : 'messages_priority',
      priority: 'high',
      defaultSound: true,
      defaultVibrateTimings: true,
    };
  }

  // ---- APNs (iOS) config ----
  message.apns = {
    headers: {
      'apns-priority': priority === 'high' ? '10' : '5', // 10 = immediate, 5 = low power
      'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl), // Seconds since epoch
    },
    payload: {
      // Carry the data block here so iOS background/silent handlers receive it
      ...serializedData,
      title,
      body,
      type,
      aps: forceDataOnly 
        ? { 'content-available': 1 }  // Silent / background push
        : {
            alert: { title, body },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
    },
  };

  return message;
}

/**
 * Send a push notification to a single user.
 * 
 * @param {string} userId 
 * @param {object} notification - { title, body, type, isHighPriority, isDataOnly, data }
 */
export async function sendPushNotification(userId, notification) {
  if (!firebaseAdmin) {
    console.log('Push notifications disabled – Firebase not initialized');
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    const tokenDoc = await findTokenByUserId(userId);
    if (!tokenDoc?.deviceToken) {
      console.log(`No FCM token found for user ${userId}`);
      return { success: false, reason: 'no_token' };
    }

    // Skip sending if the timer has already expired
    if (notification.type === 'timer' && notification.data?.endTime) {
      const endMs = Number(notification.data.endTime);
      if (!isNaN(endMs) && endMs <= Date.now()) {
        console.warn(`⏰ Skipped expired timer notification for user ${userId}`);
        return { success: false, reason: 'timer_expired' };
      }
    }

    const message = buildMessage(tokenDoc.deviceToken, notification);
    const response = await firebaseAdmin.messaging().send(message);
    console.log(`📬 Push sent to ${userId}:`, response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error(`Failed to send push to ${userId}:`, error.message);

    // Remove stale tokens so devices can re-register
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log(`Removing invalid token for user ${userId}`);
      try {
        await unregisterToken(userId);
      } catch (cleanupError) {
        console.error(`Failed to remove token for ${userId}:`, cleanupError.message);
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Broadcast a push notification to all (or specific) users.
 * 
 * @param {object} notification 
 * @param {string[]} [targetUserIds] - If provided, only these users are targeted.
 * @returns {{ successCount: number, failureCount: number, results: object[] }}
 */
export async function broadcastPushNotification(notification, targetUserIds = null) {
  if (!firebaseAdmin) {
    console.log('Push notifications disabled – Firebase not initialized');
    return { successCount: 0, failureCount: 0, results: [] };
  }

  // Skip if timer has already expired
  if (notification.type === 'timer' && notification.data?.endTime) {
    const endMs = Number(notification.data.endTime);
    if (!isNaN(endMs) && endMs <= Date.now()) {
      console.warn('⏰  Broadcast skipped – timer notification endTime is in the past');
      return { successCount: 0, failureCount: 0, results: [], reason: 'timer_expired' };
    }
  }

  // Fetch tokens
  const { getNotificationTokens } = await import('../models/notificationTokenModel.js');
  let tokenDocs = await getNotificationTokens();

  if (targetUserIds && targetUserIds.length > 0) {
    const targetSet = new Set(targetUserIds.map(String));
    tokenDocs = tokenDocs.filter(doc => targetSet.has(String(doc.userId)));
  }

  if (tokenDocs.length === 0) {
    console.log('Broadcast: no registered tokens found');
    return { successCount: 0, failureCount: 0, results: [] };
  }

  const BATCH_SIZE = 500; // FCM multicast limit
  let totalSuccess = 0;
  let totalFailure = 0;
  const allResults = [];

  for (let i = 0; i < tokenDocs.length; i += BATCH_SIZE) {
    const batch = tokenDocs.slice(i, i + BATCH_SIZE);
    const tokens = batch.map(doc => doc.deviceToken);

    // Build a template message and swap the single token for the multicast list
    const sampleMsg = buildMessage(tokens[0], notification);
    const { token: _unused, ...msgWithoutToken } = sampleMsg;

    const multicastMessage = {
      ...msgWithoutToken,
      tokens,
    };

    try {
      const batchResponse = await firebaseAdmin.messaging().sendEachForMulticast(multicastMessage);
      totalSuccess += batchResponse.successCount;
      totalFailure += batchResponse.failureCount;

      // Clean up invalid tokens
      batchResponse.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            const userId = batch[idx]?.userId;
            if (userId) {
              try { await unregisterToken(userId); } catch (_) {}
            }
          }
          allResults.push({ userId: batch[idx]?.userId, success: false, error: resp.error?.message });
        } else {
          allResults.push({ userId: batch[idx]?.userId, success: true, messageId: resp.messageId });
        }
      });
    } catch (error) {
      console.error('Broadcast batch error:', error.message);
      totalFailure += batch.length;
    }
  }

  console.log(`📢 Broadcast complete – ✅ ${totalSuccess} sent, ❌ ${totalFailure} failed`);
  return { successCount: totalSuccess, failureCount: totalFailure, results: allResults };
}

/**
 * Deprecated alias for broadcastPushNotification.
 * Included for backward compatibility across the codebase.
 * 
 * @param {string[]} userIds 
 * @param {object} notification 
 */
export async function sendPushToMultiple(userIds, notification) {
  return broadcastPushNotification(notification, userIds);
}
