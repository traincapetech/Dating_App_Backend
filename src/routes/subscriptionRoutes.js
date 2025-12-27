import {Router} from 'express';
import {
  getSubscriptionStatusController,
  createSubscriptionController,
  createPaymentOrderController,
  verifyPaymentAndCreateSubscriptionController,
  cancelSubscriptionController,
  getUserSubscriptionsController,
  verifyPremiumStatusController,
  getAvailablePlansController,
} from '../controllers/subscriptionController.js';
import {setAutoRenewal} from '../services/subscriptionRenewalService.js';

const router = Router();

// Get available subscription plans
router.get('/plans', getAvailablePlansController);

// Get user's subscription status
router.get('/status/:userId', getSubscriptionStatusController);

// Verify premium status (for internal use)
router.get('/verify/:userId', verifyPremiumStatusController);

// Get all subscriptions for a user
router.get('/user/:userId', getUserSubscriptionsController);

// Create payment order
router.post('/payment/order', createPaymentOrderController);

// Verify payment and create subscription
router.post('/payment/verify', verifyPaymentAndCreateSubscriptionController);

// Create new subscription (for testing - bypasses payment)
router.post('/create', createSubscriptionController);

// Cancel subscription
router.post('/cancel/:subscriptionId', cancelSubscriptionController);

// Enable/disable auto-renewal
router.post('/auto-renew/:subscriptionId', async (req, res) => {
  try {
    const {subscriptionId} = req.params;
    const {enabled} = req.body;
    const result = await setAutoRenewal(subscriptionId, enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

export default router;

