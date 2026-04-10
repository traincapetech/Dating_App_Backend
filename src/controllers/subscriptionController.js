import {asyncHandler} from '../utils/asyncHandler.js';
import {
  createSubscription,
  findSubscriptionByUserId,
  findSubscriptionById,
  updateSubscription,
  cancelSubscription,
  getAllUserSubscriptions,
  isUserPremium,
  getPlanDetails,
} from '../models/Subscription.js';
import {updateUser, findUserById} from '../models/userModel.js';
import {
  createPaymentOrder,
  verifyPayment,
  detectPaymentGateway,
  processRefund,
  handleGooglePlayRTDN,
} from '../services/paymentService.js';
import {setAutoRenewal} from '../services/subscriptionRenewalService.js';
import {
  handleSubscriptionCancellation,
  updateUserPremiumStatus,
  handleRenewalFailure,
} from '../services/subscriptionExpiryService.js';
import emailService from '../services/emailNotificationService.js';

// Get user's subscription status
export const getSubscriptionStatusController = asyncHandler(
  async (req, res) => {
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
  },
);

// Create payment order for subscription
export const createPaymentOrderController = asyncHandler(async (req, res) => {
  const {userId, planId, currency, country} = req.body;

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
  console.log(`[SubscriptionOrder] Checking active sub for user: ${userId}`);
  const existingSubscription = await findSubscriptionByUserId(userId);
  let finalPrice = planDetails.price;
  let isUpgrade = false;
  let upgradeCredit = 0;

  if (existingSubscription) {
    console.log(
      `[SubscriptionOrder] Found existing sub: ${existingSubscription.id}, Plan: ${existingSubscription.planId}`,
    );
    const currentPlan = getPlanDetails(existingSubscription.planId);
    if (currentPlan) {
      console.log(
        `[SubscriptionOrder] Ranks - New: ${planDetails.rank}, Current: ${currentPlan.rank}`,
      );
      if (currentPlan.id === planId) {
        return res.status(400).json({
          success: false,
          message: `You already have an active ${currentPlan.name}. You cannot purchase the same plan twice.`,
        });
      }

      if (planDetails.rank > currentPlan.rank) {
        // Upgrade logic: Calculate credit for remaining days
        isUpgrade = true;
        const now = new Date();
        const expiresAt = new Date(existingSubscription.expiresAt);
        const remainingTime = expiresAt - now;
        const remainingDays = Math.max(
          0,
          Math.ceil(remainingTime / (1000 * 60 * 60 * 24)),
        );

        // Credit = (remaining days / total days) * original price
        upgradeCredit =
          (remainingDays / currentPlan.duration) * currentPlan.price;
        finalPrice = Math.max(0, planDetails.price - upgradeCredit);
        // Round to 2 decimal places
        finalPrice = Math.round(finalPrice * 100) / 100;

        console.log(
          `[Upgrade] User ${userId} upgrading from ${currentPlan.id} to ${planId}. Credit: ${upgradeCredit}, Final Price: ${finalPrice}`,
        );
      } else {
        console.log('[SubscriptionOrder] Downgrade/Same-tier blocked.');
        return res.status(400).json({
          success: false,
          message:
            'You already have a higher-tier active subscription. Downgrades are not pro-rated.',
        });
      }
    } else {
      console.warn(
        `[SubscriptionOrder] Existing sub has unknown planId: ${existingSubscription.planId}`,
      );
      // If we don't know the plan, we should still probably block overlaps
      return res.status(400).json({
        success: false,
        message:
          'You already have an active subscription. Please manage it in settings.',
      });
    }
  } else {
    console.log(
      `[SubscriptionOrder] No existing active sub found for user: ${userId}`,
    );
  }

  // Use provided currency or default from plan
  const paymentCurrency = currency || planDetails.currency || 'USD';

  // Get price for currency
  // For now, we only support pro-rating in the base currency (default USD)
  // If currency is different, we'd need a multi-currency conversion or just use the plan's base price
  const price = isUpgrade
    ? finalPrice
    : planDetails.prices?.[paymentCurrency] || planDetails.price || 0;

  // Convert to smallest currency unit (paise for INR, cents for USD)
  const amount = Math.round(price * 100);

  // Create payment order (auto-detects gateway)
  const paymentOrder = await createPaymentOrder(
    userId,
    planId,
    amount,
    paymentCurrency,
    country,
  );

  res.status(200).json({
    success: true,
    paymentOrder,
    plan: {
      ...planDetails,
      originalPrice: planDetails.price,
      proRatedPrice: finalPrice,
      isUpgrade,
      upgradeCredit,
    },
  });
});

// Verify payment and create subscription
export const verifyPaymentAndCreateSubscriptionController = asyncHandler(
  async (req, res) => {
    const {
      userId,
      planId,
      orderId,
      paymentId,
      signature,
      paymentMethod,
      gateway,
      currency,
      autoRenew = true,
      additionalData = {},
    } = req.body;

    if (!userId || !planId || !orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'User ID, Plan ID, Order ID, and Payment ID are required',
      });
    }

    // Detect gateway if not provided
    const paymentGateway =
      gateway || paymentMethod || detectPaymentGateway(currency || 'USD');

    // Verify payment
    const verification = await verifyPayment(
      paymentGateway,
      orderId,
      paymentId,
      signature,
      additionalData,
    );
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
      const currentPlan = getPlanDetails(existingSubscription.planId);
      const isUpgrade = currentPlan && planDetails.rank > currentPlan.rank;

      let newExpiry;
      if (isUpgrade) {
        // Upgrade: Start fresh duration from now
        newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + planDetails.duration);
      } else {
        // Extension: Add duration to existing expiry
        const currentExpiry = new Date(existingSubscription.expiresAt);
        newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + planDetails.duration);
      }

      const updated = await updateSubscription(existingSubscription.id, {
        planId,
        planName: planDetails.name,
        expiresAt: newExpiry.toISOString(),
        paymentMethod,
        transactionId: paymentId,
        orderId,
        status: 'active',
        autoRenew,
        features: planDetails.features,
      });

      // Update user's premium status using expiry service
      await updateUserPremiumStatus(userId);

      // ── Send payment confirmation email (Upgrade/Extend) ───────────
      try {
        const user = await findUserById(userId);
        if (user?.email) {
          await emailService.sendSubscriptionEmail(
            user.email,
            planDetails.name,
            newExpiry.toLocaleDateString()
          );
        }
      } catch (e) {
        console.error('[Email] Failed to send upgrade email:', e.message);
      }

      return res.status(200).json({
        success: true,
        message: isUpgrade
          ? 'Subscription upgraded successfully'
          : 'Subscription extended successfully',
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

    // Update user's premium status using expiry service
    await updateUserPremiumStatus(userId);

    // ── Send payment confirmation email (New Subscription) ─────────
    try {
      const user = await findUserById(userId);
      if (user?.email) {
        await emailService.sendSubscriptionEmail(
          user.email,
          planDetails.name,
          expiresAt.toLocaleDateString()
        );
      }
    } catch (e) {
      console.error('[Email] Failed to send purchase email:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription,
    });
  },
);

// Create new subscription (legacy endpoint - for testing without payment)
export const createSubscriptionController = asyncHandler(async (req, res) => {
  const {
    userId,
    planId,
    paymentMethod,
    transactionId,
    autoRenew = true,
  } = req.body;

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
    const currentPlan = getPlanDetails(existingSubscription.planId);
    const isUpgrade = currentPlan && planDetails.rank > currentPlan.rank;

    let newExpiry;
    if (isUpgrade) {
      // Upgrade: Start fresh duration from now
      newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + planDetails.duration);
    } else {
      // Extension: Add duration to existing expiry
      const currentExpiry = new Date(existingSubscription.expiresAt);
      newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + planDetails.duration);
    }

    const updated = await updateSubscription(existingSubscription.id, {
      planId,
      planName: planDetails.name,
      expiresAt: newExpiry.toISOString(),
      paymentMethod: paymentMethod || 'test',
      transactionId: transactionId || `test_${Date.now()}`,
      status: 'active',
      autoRenew,
      features: planDetails.features,
    });

    return res.status(200).json({
      success: true,
      message: isUpgrade
        ? 'Subscription upgraded successfully'
        : 'Subscription extended successfully',
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

  // Update user's premium status using expiry service
  await updateUserPremiumStatus(userId);

  res.status(201).json({
    success: true,
    message: 'Subscription created successfully',
    subscription,
  });
});

// Cancel subscription
export const cancelSubscriptionController = asyncHandler(async (req, res) => {
  const {subscriptionId} = req.params;
  const {userId, reason} = req.body;

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

  // Use expiry service to handle cancellation properly
  const result = await handleSubscriptionCancellation(subscriptionId, reason);

  // ── Send cancellation confirmation email ────────────────────────
  try {
    const user = await findUserById(userId);
    if (user?.email) {
      await emailService.sendCancellationEmail(
        user.email,
        subscription.planName || 'Premium',
        new Date(result.expiresAt).toLocaleDateString()
      );
    }
  } catch (e) {
    console.error('[Email] Failed to send cancellation email:', e.message);
  }

  res.status(200).json({
    success: true,
    message:
      'Subscription cancelled successfully. You will retain access until the end of your billing period.',
    subscription: await findSubscriptionById(subscriptionId),
    expiresAt: result.expiresAt,
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

  // Update user's premium status using expiry service
  await updateUserPremiumStatus(userId);
  const isPremiumUpdated = await isUserPremium(userId);

  res.status(200).json({
    success: true,
    isPremium: isPremiumUpdated,
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

/**
 * Refund a subscription.
 * Policy: Full refund within 24 hours of purchase. No refund after 24 hours.
 * Only applies to Stripe payments; in-app purchases must be handled via app stores.
 */
export const refundSubscriptionController = asyncHandler(async (req, res) => {
  const {subscriptionId} = req.params;
  const {userId, reason} = req.body;

  if (!subscriptionId || !userId) {
    return res.status(400).json({success: false, message: 'Subscription ID and User ID are required'});
  }

  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({success: false, message: 'Subscription not found'});
  }

  if (subscription.userId !== userId) {
    return res.status(403).json({success: false, message: 'Unauthorized to refund this subscription'});
  }

  if (subscription.status === 'refunded') {
    return res.status(400).json({success: false, message: 'Subscription already refunded'});
  }

  // ── 24-hour refund policy ────────────────────────────────────────────────
  const createdAt = new Date(subscription.createdAt);
  const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed > 24) {
    return res.status(400).json({
      success: false,
      message: 'Refund period has expired. Refunds are only available within 24 hours of purchase.',
      hoursElapsed: Math.floor(hoursElapsed),
    });
  }

  // ── Process refund ───────────────────────────────────────────────────────
  const gateway = subscription.paymentMethod || 'stripe';
  const paymentId = subscription.transactionId;

  let refundResult = {success: false};
  if (paymentId) {
    try {
      refundResult = await processRefund(gateway, paymentId, subscription.price, subscription.currency || 'USD');
    } catch (refundError) {
      console.error('[Refund] Payment processor error:', refundError.message);
      return res.status(500).json({success: false, message: 'Refund processing failed. Please contact support.'});
    }
  }

  // ── Mark subscription as refunded ────────────────────────────────────────
  await updateSubscription(subscriptionId, {
    status: 'refunded',
    refundedAt: new Date().toISOString(),
    refundReason: reason || 'User requested refund within 24h window',
    refundId: refundResult.refundId,
    autoRenew: false,
  });

  // Revoke premium immediately
  await updateUserPremiumStatus(userId);

  // ── Send refund confirmation email ───────────────────────────────────────
  try {
    const user = await findUserById(userId);
    if (user?.email) {
      await emailService.sendRefundEmail(
        user.email,
        subscription.planName || 'Premium',
        subscription.price,
        subscription.currency || 'USD',
        refundResult.refundId
      );
    }
  } catch (emailErr) {
    console.error('[Refund] Failed to send refund email:', emailErr.message);
  }

  res.status(200).json({
    success: true,
    message: 'Refund processed successfully. Please allow 5–10 business days for it to appear.',
    refundId: refundResult.refundId,
  });
});

/**
 * Google Play Real-Time Developer Notifications (RTDN) webhook.
 * Google sends a Pub/Sub push message to this endpoint when a subscription event occurs.
 * Must be registered in Google Play Console → Monetize → Subscriptions → Real-time notifications.
 */
export const googlePlayRTDNController = asyncHandler(async (req, res) => {
  // Pub/Sub sends: { message: { data: '<base64>', messageId: '...' }, subscription: '...' }
  const message = req.body?.message;

  if (!message || !message.data) {
    return res.status(400).json({success: false, message: 'Invalid Pub/Sub message'});
  }

  // Acknowledge immediately (Google will retry if we don't return 2xx within a few seconds)
  res.status(200).json({success: true});

  // Process asynchronously so we don't block the response
  setImmediate(async () => {
    try {
      await handleGooglePlayRTDN(message);
    } catch (err) {
      console.error('[RTDN] Async processing error:', err.message);
    }
  });
});
