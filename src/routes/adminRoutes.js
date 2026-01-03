import {Router} from 'express';
import {
  adminLoginController,
  getAdminProfileController,
  getAllSubscriptionsController,
  getSubscriptionDetailsController,
  processRefundController,
  cancelSubscriptionAdminController,
  getPaymentStatsController,
  getAllUsersController,
  getUserDetailsController,
  toggleUserStatusController,
  deleteUserController,
  getDashboardAnalyticsController,
  getAllReportsController,
  getReportDetailsController,
  updateReportStatusController,
  getPendingProfilesController,
  moderateProfileController,
  getFlaggedProfilesController,
} from '../controllers/adminController.js';
import {verifyAdminToken, requirePermission, requireAnyPermission} from '../middlewares/adminAuth.js';

const router = Router();

// Public routes
router.post('/login', adminLoginController);

// Protected routes (require admin authentication)
router.use(verifyAdminToken);

// Admin profile
router.get('/profile', getAdminProfileController);

// Dashboard & Analytics
router.get('/dashboard/analytics', requirePermission('view_analytics'), getDashboardAnalyticsController);

// Subscription & Payment Management
router.get('/subscriptions', requirePermission('view_subscriptions'), getAllSubscriptionsController);
router.get('/subscriptions/:subscriptionId', requirePermission('view_subscriptions'), getSubscriptionDetailsController);
router.post('/subscriptions/:subscriptionId/refund', requirePermission('process_refunds'), processRefundController);
router.post('/subscriptions/:subscriptionId/cancel', requirePermission('manage_subscriptions'), cancelSubscriptionAdminController);
router.get('/payments/stats', requirePermission('view_subscriptions'), getPaymentStatsController);

// User Management
router.get('/users', requirePermission('view_users'), getAllUsersController);
router.get('/users/:userId', requirePermission('view_users'), getUserDetailsController);
router.post('/users/:userId/suspend', requirePermission('manage_users'), toggleUserStatusController);
router.delete('/users/:userId', requirePermission('manage_users'), deleteUserController);

// Report Management
router.get('/reports', requirePermission('view_reports'), getAllReportsController);
router.get('/reports/:reportId', requirePermission('view_reports'), getReportDetailsController);
router.put('/reports/:reportId/status', requirePermission('view_reports'), updateReportStatusController);

// Profile Moderation
router.get('/profiles/pending', requirePermission('moderate_content'), getPendingProfilesController);
router.get('/profiles/flagged', requirePermission('moderate_content'), getFlaggedProfilesController);
router.post('/profiles/:profileId/moderate', requirePermission('moderate_content'), moderateProfileController);

export default router;

