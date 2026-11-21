import {Router} from 'express';
import {
  getSubscriptionStatusController,
  createPaymentOrderController,
  verifyPaymentAndCreateSubscriptionController,
  cancelSubscriptionController,
  getUserSubscriptionsController,
  verifyPremiumStatusController,
  getAvailablePlansController,
  refundSubscriptionController,
  googlePlayRTDNController,
} from '../controllers/subscriptionController.js';
import {setAutoRenewal} from '../services/subscriptionRenewalService.js';
import {revenueCatWebhookController} from '../controllers/revenueCatController.js';
import {requireAuth} from '../middlewares/auth.js';

const router = Router();

const requirePaymentsEnabled = (_req, res, next) => {
  if (process.env.ENABLE_PAYMENTS !== 'true') {
    return res.status(503).json({
      success: false,
      message: 'Subscriptions and payments are disabled in this free release.',
    });
  }
  return next();
};

// Public routes
router.get('/plans', getAvailablePlansController);
// Google Play Real-Time Developer Notifications (RTDN) webhook (disabled during free launch)
router.post('/webhooks/google-play', requirePaymentsEnabled, googlePlayRTDNController);
// RevenueCat webhook (authenticated via Bearer REVENUECAT_WEBHOOK_AUTH)
router.post('/webhooks/revenuecat', requirePaymentsEnabled, revenueCatWebhookController);

// Protected routes (require valid JWT)
router.use(requireAuth);

router.get('/status/:userId', getSubscriptionStatusController);
router.get('/verify/:userId', verifyPremiumStatusController);
router.get('/user/:userId', getUserSubscriptionsController);
router.post('/payment/order', requirePaymentsEnabled, createPaymentOrderController);
router.post('/payment/verify', requirePaymentsEnabled, verifyPaymentAndCreateSubscriptionController);
router.post('/cancel/:subscriptionId', requirePaymentsEnabled, cancelSubscriptionController);
router.post('/refund/:subscriptionId', requirePaymentsEnabled, refundSubscriptionController);

router.post('/auto-renew/:subscriptionId', async (req, res) => {
  try {
    const {subscriptionId} = req.params;
    const {enabled} = req.body;
    const result = await setAutoRenewal(subscriptionId, enabled, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({success: false, message: 'Failed to update auto-renewal'});
  }
});

export default router;
