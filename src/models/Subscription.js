import {storage} from '../storage/index.js';

const SUBSCRIPTIONS_PATH = 'data/subscriptions.json';

export async function getSubscriptions() {
  return storage.readJson(SUBSCRIPTIONS_PATH, []);
}

export async function findSubscriptionByUserId(userId) {
  if (!userId) return null;
  const subscriptions = await getSubscriptions();
  const searchId = String(userId);

  console.log(
    `[SubscriptionModel] Finding sub for ${searchId}. Total subs: ${subscriptions.length}`,
  );

  // Find active, cancelled, or payment_failed subscriptions (not expired/refunded)
  // Sort by updatedAt desc to find the most recent one first
  const userSubs = subscriptions
    .filter(sub => String(sub.userId) === searchId)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const activeSub = userSubs.find(
    sub =>
      sub.status === 'active' ||
      sub.status === 'cancelled' ||
      sub.status === 'payment_failed',
  );

  if (activeSub) {
    console.log(
      `[SubscriptionModel] Found active sub: ${activeSub.id}, status: ${activeSub.status}, plan: ${activeSub.planId}`,
    );
  } else {
    console.log(`[SubscriptionModel] No active sub found for ${searchId}`);
  }
  return activeSub;
}

export async function findSubscriptionById(subscriptionId) {
  const subscriptions = await getSubscriptions();
  return subscriptions.find(sub => sub.id === subscriptionId);
}

export async function createSubscription(subscription) {
  const subscriptions = await getSubscriptions();
  const newSubscription = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...subscription,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  subscriptions.push(newSubscription);
  await storage.writeJson(SUBSCRIPTIONS_PATH, subscriptions);
  return newSubscription;
}

export async function updateSubscription(subscriptionId, updates) {
  const subscriptions = await getSubscriptions();
  const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
  if (index === -1) {
    return null;
  }
  const updatedSubscription = {
    ...subscriptions[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  subscriptions[index] = updatedSubscription;
  await storage.writeJson(SUBSCRIPTIONS_PATH, subscriptions);
  return updatedSubscription;
}

export async function cancelSubscription(subscriptionId) {
  return updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });
}

export async function getAllUserSubscriptions(userId) {
  const subscriptions = await getSubscriptions();
  return subscriptions.filter(sub => sub.userId === userId);
}

// Check if user has active premium subscription
export async function isUserPremium(userId) {
  const subscription = await findSubscriptionByUserId(userId);
  if (!subscription) {
    return false;
  }

  // Check if subscription is still valid
  const now = new Date();
  const expiresAt = new Date(subscription.expiresAt);

  // Check expiry date first (most important)
  if (expiresAt < now) {
    // Subscription expired, update status and revoke premium
    await updateSubscription(subscription.id, {
      status: 'expired',
      expiredAt: new Date().toISOString(),
    });

    // Update user premium status
    const {updateUser} = await import('./userModel.js');
    await updateUser(userId, {
      isPremium: false,
      premiumExpiresAt: null,
    });

    return false;
  }

  // Status check: active or cancelled (cancelled keeps premium until expiry)
  // payment_failed also keeps premium until expiry
  if (
    subscription.status === 'active' ||
    subscription.status === 'cancelled' ||
    subscription.status === 'payment_failed'
  ) {
    return true; // Premium granted until expiry
  }

  // Other statuses (expired, refunded) don't grant premium
  return false;
}

import {getPlanDetails as getPlanDetailsFromConfig} from '../config/subscriptionPlans.js';

// Get subscription plan details
export function getPlanDetails(planId) {
  return getPlanDetailsFromConfig(planId);
}
