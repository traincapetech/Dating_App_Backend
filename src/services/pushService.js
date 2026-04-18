import firebaseAdmin from '../config/firebase.js';
import { findTokenByUserId, unregisterToken, getTokensByUserIds, registerToken } from '../models/notificationTokenModel.js';

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
 * Build an FCM message object according to the specifications.
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

  // Timer/live/fullscreen: force data-only on ALL platforms (background handler renders custom UI)
  const forceDataOnly = type === 'timer' || type === 'full_screen' || type === 'live' || isDataOnly;

  // Chat messages: data-only on Android (so Notifee background handler shows reply button),
  // but VISIBLE notification on iOS (OS delivers it while app is background/killed)
  const androidDataOnly = forceDataOnly || type === 'chat_message';
  const iosDataOnly     = forceDataOnly; // iOS always shows visible for chat

  const priority = isHighPriority || type === 'timer' || type === 'full_screen' ? 'high' : 'normal';

  const message = {
    token: deviceToken,
    // Top-level data block — always present so background handlers receive payload
    data: {
      ...serializedData,
      title,
      body,
      type,
    },
  };

  // ---- Visible notification block (only for non-data-only platforms) ----
  // We omit the top-level notification so we can control per-platform below.

  // ---- Android config ----
  message.android = {
    priority: 'high',
    ttl: ttl * 1000,
    data: {
      ...serializedData,
      title,
      body,
      type,
    },
  };

  if (!androidDataOnly) {
    // Non-chat: show a regular system notification on Android too
    message.android.notification = {
      channelId: type === 'timer' ? 'timer_priority' : 'messages_priority_v2',
      priority: 'high',
      defaultSound: true,
      defaultVibrateTimings: true,
    };
  }
  // For chat on Android we intentionally omit android.notification so the
  // setBackgroundMessageHandler fires and Notifee renders the rich notification.

  // ---- APNs (iOS) config ----
  message.apns = {
    headers: {
      'apns-priority': '10', // Always immediate for chat
      'apns-push-type': iosDataOnly ? 'background' : 'alert',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
    },
    payload: {
      ...serializedData,
      title,
      body,
      type,
      aps: iosDataOnly
        ? { 'content-available': 1 }
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
    // Primary: check the NotificationToken collection
    let tokenDoc = await findTokenByUserId(userId);
    let deviceToken = tokenDoc?.deviceToken;

    // Fallback: if no NotificationToken record, try User.fcmToken directly
    if (!deviceToken) {
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(userId).select('fcmToken');
      deviceToken = user?.fcmToken;
      if (deviceToken) {
        console.log(`[Push] Using fallback User.fcmToken for ${userId}`);
        // Also backfill into NotificationToken so future lookups work correctly
        await registerToken(userId, deviceToken, 'unknown');
      }
    }

    if (!deviceToken) {
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

    const message = buildMessage(deviceToken, notification);
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
 * Send a push notification to multiple users.
 * 
 * @param {string[]} userIds 
 * @param {object} notification 
 */
export async function sendPushToMultiple(userIds, notification) {
  // Using broadcastPushNotification which is optimized for multiple tokens
  return broadcastPushNotification(notification, userIds);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK NOTIFICATION (scalable multicast – merges both token sources)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a push notification to multiple users efficiently using FCM multicast.
 *
 * Token resolution strategy (both sources merged + deduplicated):
 *   1. notificationTokenModel  – primary, always checked first
 *   2. User.fcmToken           – fallback for users who haven't refreshed yet
 *
 * @param {object} options
 * @param {string}   options.title    - Notification title
 * @param {string}   options.body     - Notification body
 * @param {string[]} options.userIds  - Array of user IDs to notify
 * @param {object}  [options.data]    - Optional extra key-value payload
 * @param {string}  [options.type]    - Notification type (default: 'general')
 * @returns {Promise<{ successCount: number, failureCount: number }>}
 */
export async function sendBulkNotifications({ title, body, userIds, data = {}, type = 'general' }) {
  if (!firebaseAdmin) {
    console.warn('[Bulk Push] Firebase not initialized – skipping');
    return { successCount: 0, failureCount: 0 };
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    console.warn('[Bulk Push] No userIds provided');
    return { successCount: 0, failureCount: 0 };
  }

  const notification = { title, body, type, data };

  // ── 1. Collect tokens from notificationTokenModel ─────────────────────────
  const tokenDocs = await getTokensByUserIds(userIds);

  // Map userId → token from the primary collection
  const tokenMap = new Map(); // token → userId  (inverted for dedup)
  const userTokenMap = new Map(); // userId → token  (for cleanup)

  for (const doc of tokenDocs) {
    if (doc.deviceToken) {
      tokenMap.set(doc.deviceToken, String(doc.userId));
      userTokenMap.set(String(doc.userId), doc.deviceToken);
    }
  }

  // ── 2. Fallback: fetch User.fcmToken for any userId not yet covered ────────
  const coveredUserIds = new Set(userTokenMap.keys());
  const missingUserIds = userIds.map(String).filter(id => !coveredUserIds.has(id));

  if (missingUserIds.length > 0) {
    try {
      const User = (await import('../models/User.js')).default;
      const fallbackUsers = await User.find(
        { _id: { $in: missingUserIds } },
        { _id: 1, fcmToken: 1 },
      ).lean();

      for (const user of fallbackUsers) {
        const uid = String(user._id);
        const tok = user.fcmToken;
        if (tok && !tokenMap.has(tok)) {
          tokenMap.set(tok, uid);
          userTokenMap.set(uid, tok);
          // Backfill into NotificationToken for next time
          registerToken(uid, tok, 'unknown').catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Bulk Push] Fallback User.fcmToken fetch failed:', err.message);
    }
  }

  // ── 3. Build final deduplicated token list ────────────────────────────────
  // tokenMap keys are unique tokens; values are userIds for cleanup
  const allTokens = [...tokenMap.keys()].filter(t => typeof t === 'string' && t.length > 10);

  if (allTokens.length === 0) {
    console.log('[Bulk Push] No valid tokens found for provided userIds');
    return { successCount: 0, failureCount: 0 };
  }

  console.log(`[Bulk Push] Sending "${title}" → ${allTokens.length} devices (${userIds.length} users)`);

  // ── 4. Send in batches of 500 (FCM hard limit per multicast call) ──────────
  const BATCH_SIZE = 500;
  let totalSuccess = 0;
  let totalFailure = 0;

  for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
    const batchTokens = allTokens.slice(i, i + BATCH_SIZE);

    // Build payload using the first token as template then swap to multicast
    const sampleMsg = buildMessage(batchTokens[0], notification);
    const { token: _drop, ...msgWithoutToken } = sampleMsg;
    const multicastMsg = { ...msgWithoutToken, tokens: batchTokens };

    try {
      const batchResponse = await firebaseAdmin.messaging().sendEachForMulticast(multicastMsg);
      totalSuccess += batchResponse.successCount;
      totalFailure += batchResponse.failureCount;

      // ── 5. Clean up invalid tokens ────────────────────────────────────────
      for (let j = 0; j < batchResponse.responses.length; j++) {
        const resp = batchResponse.responses[j];
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            const staleToken = batchTokens[j];
            const ownerUserId = tokenMap.get(staleToken);
            if (ownerUserId) {
              unregisterToken(ownerUserId).catch(() => {});
              console.log(`[Bulk Push] Removed stale token for user ${ownerUserId}`);
            }
          }
        }
      }
    } catch (batchError) {
      console.error(`[Bulk Push] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, batchError.message);
      totalFailure += batchTokens.length;
    }
  }

  console.log(`[Bulk Push] ✅ ${totalSuccess} sent  ❌ ${totalFailure} failed  (total ${allTokens.length} tokens)`);
  return { successCount: totalSuccess, failureCount: totalFailure };
}
