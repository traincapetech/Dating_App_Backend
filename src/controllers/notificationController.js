import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendNotification } from '../services/notificationService.js';

/**
 * Controller to save FCM token for a user
 * POST /api/notifications/token
 */
export const saveFcmToken = async (req, res) => {
  const { fcmToken, platform } = req.body;
  const userId = req.user.id;

  if (!fcmToken) {
    return res.status(400).json({ success: false, message: 'FCM token required' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken, lastActive: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'FCM token updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating FCM token' });
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
