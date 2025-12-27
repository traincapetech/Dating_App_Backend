/**
 * Subscription Auto-Renewal Service
 * Handles automatic renewal of subscriptions
 */

import {getSubscriptions, updateSubscription, isUserPremium, findSubscriptionById} from '../models/Subscription.js';
import {updateUser} from '../models/userModel.js';
import {createPaymentOrder, verifyPayment} from './paymentService.js';
import {handleRenewalFailure, updateUserPremiumStatus} from './subscriptionExpiryService.js';

/**
 * Check and renew expired subscriptions
 * This should be run as a cron job daily
 */
export async function processSubscriptionRenewals() {
  try {
    const subscriptions = await getSubscriptions();
    const now = new Date();
    const renewals = [];

    for (const subscription of subscriptions) {
      // Only process active subscriptions with auto-renew enabled
      if (subscription.status !== 'active' || !subscription.autoRenew) {
        continue;
      }

      const expiresAt = new Date(subscription.expiresAt);
      
      // Check if subscription expires within 24 hours or has expired
      const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
      
      if (hoursUntilExpiry <= 24 && hoursUntilExpiry >= -24) {
        // Attempt to renew
        const renewalResult = await attemptRenewal(subscription);
        renewals.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          success: renewalResult.success,
          message: renewalResult.message,
        });
      }
    }

    return {
      success: true,
      processed: renewals.length,
      renewals,
    };
  } catch (error) {
    console.error('Error processing subscription renewals:', error);
    throw error;
  }
}

/**
 * Attempt to renew a subscription
 */
async function attemptRenewal(subscription) {
  try {
    // Get the plan details
    const {getPlanDetails} = await import('../models/Subscription.js');
    const planDetails = getPlanDetails(subscription.planId);

    if (!planDetails) {
      return {
        success: false,
        message: 'Plan not found',
      };
    }

    // Create payment order for renewal
    const paymentResult = await createPaymentOrder(
      subscription.userId,
      subscription.planId,
      planDetails.price * 100, // Convert to paise
      planDetails.currency
    );

    if (!paymentResult.success) {
      // Payment failed - handle renewal failure
      await handleRenewalFailure(subscription.id, 'Payment creation failed');

      return {
        success: false,
        message: 'Payment creation failed. Subscription will expire at the end of current period.',
      };
    }

    // In production, you would:
    // 1. Charge the saved payment method
    // 2. Verify the payment
    // 3. Extend the subscription

    // For now, simulate successful payment
    const newExpiresAt = new Date(subscription.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + planDetails.duration);

    await updateSubscription(subscription.id, {
      expiresAt: newExpiresAt.toISOString(),
      lastRenewedAt: new Date().toISOString(),
      status: 'active',
    });

    // Update user premium status using expiry service
    await updateUserPremiumStatus(subscription.userId);

    return {
      success: true,
      message: 'Subscription renewed successfully',
      newExpiresAt: newExpiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error attempting renewal:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Enable/disable auto-renewal for a subscription
 */
export async function setAutoRenewal(subscriptionId, enabled) {
  try {
    const updated = await updateSubscription(subscriptionId, {
      autoRenew: enabled,
    });

    return {
      success: true,
      subscription: updated,
    };
  } catch (error) {
    console.error('Error setting auto-renewal:', error);
    throw error;
  }
}

