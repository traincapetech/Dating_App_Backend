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
    // Unset the fcmToken from the user
    await User.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });
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

/**
 * Fetch user notification preferences
 * GET /api/notifications/preferences/:userId
 */
export const getPreferences = async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).select('notificationSettings');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      preferences: user.notificationSettings || {
        pushEnabled: true,
        matches: true,
        messages: true,
      },
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
  const preferences = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { notificationSettings: preferences },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.notificationSettings,
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
