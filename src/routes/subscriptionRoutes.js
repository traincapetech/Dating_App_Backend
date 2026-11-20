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

// Public routes
router.get('/plans', getAvailablePlansController);
// Google Play Real-Time Developer Notifications (RTDN) webhook
router.post('/webhooks/google-play', googlePlayRTDNController);
// RevenueCat webhook (authenticated via Bearer REVENUECAT_WEBHOOK_AUTH)
router.post('/webhooks/revenuecat', revenueCatWebhookController);

// Protected routes (require valid JWT)
router.use(requireAuth);

router.get('/status/:userId', getSubscriptionStatusController);
router.get('/verify/:userId', verifyPremiumStatusController);
router.get('/user/:userId', getUserSubscriptionsController);
router.post('/payment/order', createPaymentOrderController);
router.post('/payment/verify', verifyPaymentAndCreateSubscriptionController);
router.post('/cancel/:subscriptionId', cancelSubscriptionController);
router.post('/refund/:subscriptionId', refundSubscriptionController);

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
