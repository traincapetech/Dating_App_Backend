import {storage} from '../storage/index.js';

const SUBSCRIPTIONS_PATH = 'data/subscriptions.json';

export async function getSubscriptions() {
  return storage.readJson(SUBSCRIPTIONS_PATH, []);
}

export async function findSubscriptionByUserId(userId) {
  const subscriptions = await getSubscriptions();
  return subscriptions.find(sub => sub.userId === userId && sub.status === 'active');
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

  if (expiresAt < now) {
    // Subscription expired, update status
    await updateSubscription(subscription.id, {status: 'expired'});
    return false;
  }

  return subscription.status === 'active';
}

import {getPlanDetails as getPlanDetailsFromConfig} from '../config/subscriptionPlans.js';

// Get subscription plan details
export function getPlanDetails(planId) {
  return getPlanDetailsFromConfig(planId);
}

