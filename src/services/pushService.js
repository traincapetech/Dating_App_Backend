import admin from 'firebase-admin';
import { findTokenByUserId } from '../models/notificationTokenModel.js';
import { config } from '../config/env.js';

let firebaseApp = null;

// Initialize Firebase Admin SDK
function initFirebase() {
  if (firebaseApp) return;
  
  try {
    // Check if credentials are provided via environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse service account from env variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      console.warn("⚠️ Firebase credentials not configured - push notifications disabled");
      return;
    }
    console.log("🔥 Firebase Admin SDK initialized");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

// Initialize on module load
initFirebase();

/**
 * Send push notification to a user
 * @param {string} userId - Target user ID
 * @param {object} notification - { title, body, data }
 */
export async function sendPushNotification(userId, notification) {
  if (!firebaseApp) {
    console.log("Push notifications disabled - Firebase not initialized");
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
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'messages',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`📬 Push notification sent to ${userId}:`, response);
    
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`Failed to send push to ${userId}:`, error);
    
    // If token is invalid, we could remove it here
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log(`Removing invalid token for user ${userId}`);
      // Optionally: await unregisterToken(userId);
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
    ...result
  }));
}

