import {asyncHandler} from '../utils/asyncHandler.js';
import {
  createSubscription,
  findSubscriptionByUserId,
  updateSubscription,
  cancelSubscription,
  getAllUserSubscriptions,
  isUserPremium,
  getPlanDetails,
} from '../models/Subscription.js';
import {updateUser, findUserById} from '../models/userModel.js';
import {createPaymentOrder, verifyPayment} from '../services/paymentService.js';
import {setAutoRenewal} from '../services/subscriptionRenewalService.js';

// Get user's subscription status
export const getSubscriptionStatusController = asyncHandler(async (req, res) => {
  const {userId} = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  const isPremium = await isUserPremium(userId);
  const subscription = await findSubscriptionByUserId(userId);

  res.status(200).json({
    success: true,
    isPremium,
    subscription: subscription || null,
  });
});

// Create payment order for subscription
export const createPaymentOrderController = asyncHandler(async (req, res) => {
  const {userId, planId} = req.body;

  if (!userId || !planId) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Plan ID are required',
    });
  }

  const planDetails = getPlanDetails(planId);
  if (!planDetails) {
    return res.status(400).json({
      success: false,
      message: 'Invalid plan ID',
    });
  }

  // Create payment order
  const paymentOrder = await createPaymentOrder(
    userId,
    planId,
    planDetails.price * 100, // Convert to paise
    planDetails.currency
  );

  res.status(200).json({
    success: true,
    paymentOrder,
    plan: planDetails,
  });
});

// Verify payment and create subscription
export const verifyPaymentAndCreateSubscriptionController = asyncHandler(async (req, res) => {
  const {userId, planId, orderId, paymentId, signature, paymentMethod = 'razorpay', autoRenew = true} = req.body;

  if (!userId || !planId || !orderId || !paymentId) {
    return res.status(400).json({
      success: false,
      message: 'User ID, Plan ID, Order ID, and Payment ID are required',
    });
  }

  // Verify payment
  const verification = await verifyPayment(orderId, paymentId, signature);
  if (!verification.success || !verification.verified) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
      verification,
    });
  }

  const planDetails = getPlanDetails(planId);
  if (!planDetails) {
    return res.status(400).json({
      success: false,
      message: 'Invalid plan ID',
    });
  }

  // Check if user already has active subscription
  const existingSubscription = await findSubscriptionByUserId(userId);
  if (existingSubscription) {
    // Extend existing subscription
    const currentExpiry = new Date(existingSubscription.expiresAt);
    const extensionDays = planDetails.duration;
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + extensionDays);

    const updated = await updateSubscription(existingSubscription.id, {
      planId,
      expiresAt: newExpiry.toISOString(),
      paymentMethod,
      transactionId: paymentId,
      orderId,
      status: 'active',
      autoRenew,
    });

    // Update user's premium status
    await updateUser(userId, {
      isPremium: true,
      premiumExpiresAt: newExpiry.toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription extended successfully',
      subscription: updated,
    });
  }

  // Create new subscription
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + planDetails.duration);

  const subscription = await createSubscription({
    userId,
    planId,
    planName: planDetails.name,
    status: 'active',
    expiresAt: expiresAt.toISOString(),
    paymentMethod,
    transactionId: paymentId,
    orderId,
    price: planDetails.price,
    currency: planDetails.currency,
    features: planDetails.features,
    autoRenew,
  });

  // Update user's premium status
  await updateUser(userId, {
    isPremium: true,
    premiumExpiresAt: expiresAt.toISOString(),
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    subscription,
  });
});

// Create new subscription (legacy endpoint - for testing without payment)
export const createSubscriptionController = asyncHandler(async (req, res) => {
  const {userId, planId, paymentMethod, transactionId, autoRenew = true} = req.body;

  if (!userId || !planId) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Plan ID are required',
    });
  }

  const planDetails = getPlanDetails(planId);
  if (!planDetails) {
    return res.status(400).json({
      success: false,
      message: 'Invalid plan ID',
    });
  }

  // Check if user already has active subscription
  const existingSubscription = await findSubscriptionByUserId(userId);
  if (existingSubscription) {
    // Extend existing subscription
    const currentExpiry = new Date(existingSubscription.expiresAt);
    const extensionDays = planDetails.duration;
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + extensionDays);

    const updated = await updateSubscription(existingSubscription.id, {
      planId,
      expiresAt: newExpiry.toISOString(),
      paymentMethod: paymentMethod || 'test',
      transactionId: transactionId || `test_${Date.now()}`,
      status: 'active',
      autoRenew,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription extended successfully',
      subscription: updated,
    });
  }

  // Create new subscription
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + planDetails.duration);

  const subscription = await createSubscription({
    userId,
    planId,
    planName: planDetails.name,
    status: 'active',
    expiresAt: expiresAt.toISOString(),
    paymentMethod: paymentMethod || 'test',
    transactionId: transactionId || `test_${Date.now()}`,
    price: planDetails.price,
    currency: planDetails.currency,
    features: planDetails.features,
    autoRenew,
  });

  // Update user's premium status
  await updateUser(userId, {
    isPremium: true,
    premiumExpiresAt: expiresAt.toISOString(),
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    subscription,
  });
});

// Cancel subscription
export const cancelSubscriptionController = asyncHandler(async (req, res) => {
  const {subscriptionId} = req.params;
  const {userId} = req.body;

  if (!subscriptionId || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Subscription ID and User ID are required',
    });
  }

  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  if (subscription.userId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized to cancel this subscription',
    });
  }

  const cancelled = await cancelSubscription(subscriptionId);

  // Update user's premium status if no other active subscriptions
  const hasActiveSubscription = await isUserPremium(userId);
  if (!hasActiveSubscription) {
    await updateUser(userId, {
      isPremium: false,
      premiumExpiresAt: null,
    });
  }

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully',
    subscription: cancelled,
  });
});

// Get all subscriptions for a user
export const getUserSubscriptionsController = asyncHandler(async (req, res) => {
  const {userId} = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  const subscriptions = await getAllUserSubscriptions(userId);

  res.status(200).json({
    success: true,
    subscriptions,
  });
});

// Verify premium status
export const verifyPremiumStatusController = asyncHandler(async (req, res) => {
  const {userId} = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  const isPremium = await isUserPremium(userId);

  // Update user's premium status in user model
  const user = await findUserById(userId);
  if (user) {
    await updateUser(userId, {
      isPremium,
      premiumExpiresAt: isPremium
        ? (await findSubscriptionByUserId(userId))?.expiresAt
        : null,
    });
  }

  res.status(200).json({
    success: true,
    isPremium,
  });
});

import {getAllPlans} from '../config/subscriptionPlans.js';

// Get available plans
export const getAvailablePlansController = asyncHandler(async (req, res) => {
  const plans = getAllPlans();

  res.status(200).json({
    success: true,
    plans,
  });
});

