/**
 * Subscription Expiry Service
 * Handles subscription expiration, cancellation, and premium status updates
 */

import {getSubscriptions, updateSubscription, findSubscriptionByUserId} from '../models/Subscription.js';
import {updateUser, findUserById} from '../models/userModel.js';

/**
 * Check and expire subscriptions that have passed their expiry date
 * This should be run as a cron job daily
 */
export async function processExpiredSubscriptions() {
  try {
    const subscriptions = await getSubscriptions();
    const now = new Date();
    const expired = [];

    for (const subscription of subscriptions) {
      // Only process active subscriptions
      if (subscription.status !== 'active') {
        continue;
      }

      const expiresAt = new Date(subscription.expiresAt);
      
      // Check if subscription has expired
      if (expiresAt < now) {
        // Mark as expired
        await updateSubscription(subscription.id, {
          status: 'expired',
          expiredAt: new Date().toISOString(),
        });

        // Update user's premium status
        await updateUserPremiumStatus(subscription.userId);

        expired.push({
          subscriptionId: subscription.id,
          userId: subscription.userId,
          expiredAt: expiresAt.toISOString(),
        });
      }
    }

    return {
      success: true,
      expiredCount: expired.length,
      expired,
    };
  } catch (error) {
    console.error('Error processing expired subscriptions:', error);
    throw error;
  }
}

/**
 * Handle auto-renewal failure
 * When auto-renewal fails, subscription should expire at the end of current period
 */
export async function handleRenewalFailure(subscriptionId, reason) {
  try {
    const subscription = await findSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Mark subscription as payment_failed
    // It will expire at the end of current period (expiresAt)
    await updateSubscription(subscriptionId, {
      status: 'payment_failed',
      lastRenewalAttempt: new Date().toISOString(),
      renewalFailureReason: reason || 'Payment failed',
      autoRenew: false, // Disable auto-renewal on failure
    });

    // Note: User keeps premium until expiresAt, then it will be revoked by processExpiredSubscriptions

    return {
      success: true,
      message: 'Renewal failure handled',
    };
  } catch (error) {
    console.error('Error handling renewal failure:', error);
    throw error;
  }
}

/**
 * Handle subscription cancellation
 * Subscription remains active until expiry, then expires
 */
export async function handleSubscriptionCancellation(subscriptionId, reason) {
  try {
    const subscription = await findSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Mark as cancelled but keep active until expiry
    await updateSubscription(subscriptionId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
      autoRenew: false, // Disable auto-renewal
    });

    // User keeps premium until expiresAt
    // No need to update user status immediately

    return {
      success: true,
      message: 'Subscription cancelled',
      expiresAt: subscription.expiresAt,
    };
  } catch (error) {
    console.error('Error handling cancellation:', error);
    throw error;
  }
}

/**
 * Update user's premium status based on active subscriptions
 * Should be called whenever subscription status changes
 */
export async function updateUserPremiumStatus(userId) {
  try {
    const subscription = await findSubscriptionByUserId(userId);
    const now = new Date();

    if (!subscription) {
      // No active subscription - revoke premium
      await updateUser(userId, {
        isPremium: false,
        premiumExpiresAt: null,
      });
      return false;
    }

    // Check if subscription is still valid
    const expiresAt = new Date(subscription.expiresAt);

    if (expiresAt < now || subscription.status !== 'active') {
      // Subscription expired or not active - revoke premium
      await updateUser(userId, {
        isPremium: false,
        premiumExpiresAt: null,
      });
      return false;
    }

    // Subscription is active - grant premium
    await updateUser(userId, {
      isPremium: true,
      premiumExpiresAt: expiresAt.toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error updating user premium status:', error);
    throw error;
  }
}

/**
 * Verify and sync all user premium statuses
 * Useful for maintenance or fixing inconsistencies
 */
export async function syncAllPremiumStatuses() {
  try {
    const subscriptions = await getSubscriptions();
    const now = new Date();
    const synced = [];

    for (const subscription of subscriptions) {
      const expiresAt = new Date(subscription.expiresAt);
      const shouldBePremium = 
        subscription.status === 'active' && 
        expiresAt >= now;

      const user = await findUserById(subscription.userId);
      if (!user) continue;

      const isPremium = user.isPremium || false;

      if (shouldBePremium !== isPremium) {
        await updateUser(subscription.userId, {
          isPremium: shouldBePremium,
          premiumExpiresAt: shouldBePremium ? expiresAt.toISOString() : null,
        });

        synced.push({
          userId: subscription.userId,
          wasPremium: isPremium,
          nowPremium: shouldBePremium,
        });
      }
    }

    return {
      success: true,
      syncedCount: synced.length,
      synced,
    };
  } catch (error) {
    console.error('Error syncing premium statuses:', error);
    throw error;
  }
}

