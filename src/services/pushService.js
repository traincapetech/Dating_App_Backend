import { findTokenByUserId, unregisterToken } from '../models/notificationTokenModel.js';

let admin = null;
let isInitialized = false;

// Initialize Firebase Admin SDK
async function initFirebase() {
  if (isInitialized) return admin;

  try {
    // Try to use the existing firebase.js setup
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const firebaseModule = await import('../../firebase.js');
      admin = firebaseModule.default;
      isInitialized = true;
      console.log('🔥 Firebase Admin SDK initialized (using firebase.js)');
      return admin;
    }

    // Fallback: Try environment variable approaches
    const firebaseAdmin = await import('firebase-admin');

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse service account from env variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseAdmin.default.initializeApp({
        credential: firebaseAdmin.default.credential.cert(serviceAccount),
      });
      admin = firebaseAdmin.default;
      isInitialized = true;
      console.log('🔥 Firebase Admin SDK initialized (FIREBASE_SERVICE_ACCOUNT)');
      return admin;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseAdmin.default.initializeApp({
        credential: firebaseAdmin.default.credential.applicationDefault(),
      });
      admin = firebaseAdmin.default;
      isInitialized = true;
      console.log('🔥 Firebase Admin SDK initialized (applicationDefault)');
      return admin;
    }

    console.warn('⚠️ Firebase credentials not configured - push notifications disabled');
    return null;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    return null;
  }
}

// Initialize on first use
let initPromise = null;
function getAdmin() {
  if (!initPromise) {
    initPromise = initFirebase();
  }
  return initPromise;
}

/**
 * Send push notification to a user
 * @param {string} userId - Target user ID
 * @param {object} notification - { title, body, data }
 */
export async function sendPushNotification(userId, notification) {
  const firebaseAdmin = await getAdmin();

  if (!firebaseAdmin) {
    console.log('Push notifications disabled - Firebase not initialized');
    return { success: false, reason: 'firebase_not_initialized' };
  }

  try {
    // Get user's FCM token
    const tokenDoc = await findTokenByUserId(userId);

    if (!tokenDoc || !tokenDoc.deviceToken) {
      console.log(`No FCM token found for user ${userId}`);
      return { success: false, reason: 'no_token' };
    }

    const message = {
      token: tokenDoc.deviceToken,
      data: notification.data ? Object.fromEntries(
        Object.entries(notification.data).map(([k, v]) => [k, String(v)])
      ) : {},
    };

    if (!notification.isDataOnly) {
      message.notification = {
        title: notification.title,
        body: notification.body,
      };
      message.android = {
        priority: 'high',
        notification: {
          channelId: 'messages_priority',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      };
      message.apns = {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
        },
      };
    } else {
      // Ensure data-only messages still get high priority delivery
      message.android = { 
        priority: 'high',
      };
    }

    // Always set high priority for messages sent from server
    // This allows background handlers to wake up reliably
    message.android = {
      ...message.android,
      priority: 'high',
      ttl: 3600 * 24, // 1 day
    };

    const response = await firebaseAdmin.messaging().send(message);
    console.log(`📬 Push notification sent to ${userId}:`, response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error(`Failed to send push to ${userId}:`, error.message);

    // If token is invalid, remove it so the app can re-register a fresh one
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log(`Removing invalid token for user ${userId}`);
      try {
        await unregisterToken(userId);
      } catch (cleanupError) {
        console.error(
          `Failed to remove invalid token for user ${userId}:`,
          cleanupError.message,
        );
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {object} notification - { title, body, data }
 */
export async function sendPushToMultiple(userIds, notification) {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, notification))
  );

  return results.map((result, index) => ({
    userId: userIds[index],
    ...result,
  }));
}
