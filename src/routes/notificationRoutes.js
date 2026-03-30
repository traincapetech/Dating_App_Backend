import express from 'express';
import { 
  saveFcmToken, 
  sendAdminNotification, 
  getNotificationStats 
} from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/auth.js';
import { verifyAdminToken, requirePermission } from '../middlewares/adminAuth.js';

const router = express.Router();

/**
 * User Routes
 */
// POST /api/notifications/token - Save user FCM token
router.post('/token', requireAuth, saveFcmToken);

/**
 * Admin Routes
 */
// POST /api/notifications/send - Send immediate or scheduled notification
router.post(
  '/send', 
  verifyAdminToken, 
  requirePermission('manage_notifications'), 
  sendAdminNotification
);

// GET /api/notifications/stats - Get notification history and stats
router.get(
  '/stats', 
  verifyAdminToken, 
  requirePermission('view_analytics'), 
  getNotificationStats
);

export default router;
