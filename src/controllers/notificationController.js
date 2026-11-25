import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendNotification } from '../services/notificationService.js';
import { registerToken } from '../models/notificationTokenModel.js';

/**
 * Controller to save FCM token for a user
 * POST /api/notifications/token
 */
export const saveFcmToken = async (req, res) => {
  const { fcmToken, token, platform } = req.body;
  const userId = req.user.id;

  const finalToken = fcmToken || token;

  if (!finalToken) {
    return res.status(400).json({ success: false, message: 'FCM token required' });
  }

  try {
    // Save to User model (for backward compatibility)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken: finalToken, lastActive: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // CRITICAL: Also save to NotificationToken collection — this is what
    // pushService.js reads from when sending push notifications.
    await registerToken(userId, finalToken, platform || 'unknown');

    res.json({ success: true, message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('[saveFcmToken] Error:', error);
    res.status(500).json({ success: false, message: 'Error updating FCM token' });
  }
};

/**
 * Controller to remove FCM token (when user logs out or disables notifications)
 * POST /api/notifications/unregister
 */
export const removeFcmToken = async (req, res) => {
  const userId = req.user.id;

  try {
    // Unset the fcmToken from both User and NotificationToken collection
    await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
    try {
      const NotificationToken = (await import('../models/NotificationToken.js')).default;
      await NotificationToken.deleteMany({ userId });
    } catch (_) {}
    res.json({ success: true, message: 'FCM token removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing FCM token' });
  }
};

/**
 * Controller to send or schedule a manual notification (Admin Only)
 * POST /api/notifications/send
 */
export const sendAdminNotification = async (req, res) => {
  const { title, body, audience, userIds, type, data, scheduledAt } = req.body;
  const adminId = req.admin.id;

  if (!title || !body || !audience) {
    return res.status(400).json({ success: false, message: 'Title, body, and audience are required' });
  }

  try {
    // If it's scheduled for future, just create the DB entry and return
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      const scheduledLog = await Notification.create({
        title,
        body,
        audience,
        userIds,
        type: type || 'normal',
        data,
        scheduledAt,
        status: 'pending',
        createdBy: adminId,
      });

      return res.json({
        success: true,
        message: 'Notification scheduled successfully',
        id: scheduledLog._id,
      });
    }

    // Otherwise, send immediately
    const result = await sendNotification({
      title,
      body,
      audience,
      userIds,
      type: type || 'normal',
      data,
      createdBy: adminId,
    });

    res.json({
      success: true,
      message: 'Notification sent successfully',
      stats: result.stats,
    });

  } catch (error) {
    console.error('❌ Admin notification error:', error.message);
    res.status(500).json({ success: false, message: 'Error sending notification' });
  }
};

const normalizeNotificationSettings = (raw = {}) => {
  const src = raw && typeof raw.toObject === 'function' ? raw.toObject() : raw || {};
  const newMatches =
    typeof src.newMatches === 'boolean'
      ? src.newMatches
      : typeof src.matches === 'boolean'
        ? src.matches
        : true;
  const newMessages =
    typeof src.newMessages === 'boolean'
      ? src.newMessages
      : typeof src.messages === 'boolean'
        ? src.messages
        : true;
  const newLikes =
    typeof src.newLikes === 'boolean'
      ? src.newLikes
      : typeof src.likes === 'boolean'
        ? src.likes
        : true;

  return {
    pushEnabled: typeof src.pushEnabled === 'boolean' ? src.pushEnabled : true,
    newMatches,
    newMessages,
    newLikes,
    profileViews: typeof src.profileViews === 'boolean' ? src.profileViews : false,
    superLikes: typeof src.superLikes === 'boolean' ? src.superLikes : true,
    matches: newMatches,
    messages: newMessages,
    likes: newLikes,
    streaks: typeof src.streaks === 'boolean' ? src.streaks : true,
    marketing: typeof src.marketing === 'boolean' ? src.marketing : false,
    emailNotifications:
      typeof src.emailNotifications === 'boolean' ? src.emailNotifications : true,
  };
};

/**
 * Fetch user notification preferences
 * GET /api/notifications/preferences/:userId
 */
export const getPreferences = async (req, res) => {
  const userId = req.params.userId;
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const user = await User.findById(userId).select('notificationSettings');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      preferences: normalizeNotificationSettings(user.notificationSettings),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching preferences' });
  }
};

/**
 * Update user notification preferences
 * PUT /api/notifications/preferences/:userId
 */
export const updatePreferences = async (req, res) => {
  const userId = req.params.userId;
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const allowedKeys = [
    'pushEnabled',
    'matches',
    'messages',
    'likes',
    'streaks',
    'marketing',
    'emailNotifications',
    'newMatches',
    'newMessages',
    'newLikes',
    'profileViews',
    'superLikes',
  ];
  const source =
    req.body?.preferences && typeof req.body.preferences === 'object'
      ? req.body.preferences
      : req.body || {};
  const updates = {};
  for (const key of allowedKeys) {
    if (typeof source[key] === 'boolean') {
      updates[key] = source[key];
    }
  }

  // Keep modern and legacy preference keys synchronized
  if (typeof updates.newMatches === 'boolean' && typeof updates.matches !== 'boolean') {
    updates.matches = updates.newMatches;
  } else if (typeof updates.matches === 'boolean' && typeof updates.newMatches !== 'boolean') {
    updates.newMatches = updates.matches;
  }

  if (typeof updates.newMessages === 'boolean' && typeof updates.messages !== 'boolean') {
    updates.messages = updates.newMessages;
  } else if (typeof updates.messages === 'boolean' && typeof updates.newMessages !== 'boolean') {
    updates.newMessages = updates.messages;
  }

  if (typeof updates.newLikes === 'boolean' && typeof updates.likes !== 'boolean') {
    updates.likes = updates.newLikes;
  } else if (typeof updates.likes === 'boolean' && typeof updates.newLikes !== 'boolean') {
    updates.newLikes = updates.likes;
  }

  try {
    const existingUser = await User.findById(userId).select('notificationSettings');
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const mergedSettings = normalizeNotificationSettings({
      ...normalizeNotificationSettings(existingUser.notificationSettings),
      ...updates,
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationSettings: mergedSettings } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: normalizeNotificationSettings(user.notificationSettings),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating preferences' });
  }
};

/**
 * Fetch notification analytics (Admin Only)
 * GET /api/notifications/stats
 */
export const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(10); // Last 10 notification job results

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
};
