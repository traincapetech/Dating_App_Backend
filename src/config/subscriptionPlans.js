/**
 * Subscription Plans Configuration
 * Update prices here - they will be used across the application
 */

export const SUBSCRIPTION_PLANS = {
  daily: {
    id: 'daily',
    rank: 1,
    name: '1 Day Premium',
    label: '1 day',
    duration: 1, // days
    price: 1.99,
    currency: 'USD',
    period: 'day',
    features: [
      'unlimited_likes',
      'see_who_liked_you',
      'advanced_filters',
      'priority_matching',
    ],
  },
  '1week': {
    id: '1week',
    rank: 2,
    name: '1 Week Premium',
    label: '1 week',
    duration: 7, // days
    price: 9.99,
    currency: 'USD',
    period: 'wk',
    features: [
      'unlimited_likes',
      'see_who_liked_you',
      'advanced_filters',
      'priority_matching',
    ],
  },
  '1month': {
    id: '1month',
    rank: 3,
    name: '1 Month Premium',
    label: '1 month',
    duration: 30,
    price: 19.99,
    currency: 'USD',
    period: 'mo',
    popular: true,
    features: [
      'unlimited_likes',
      'see_who_liked_you',
      'advanced_filters',
      'priority_matching',
    ],
  },
  '3months': {
    id: '3months',
    rank: 4,
    name: '3 Months Premium',
    label: '3 months',
    duration: 90,
    price: 39.99, // ~ $13.33/mo
    currency: 'USD',
    period: 'mo',
    savings: 'Save 33%',
    monthlyPrice: 13.33,
    features: [
      'unlimited_likes',
      'see_who_liked_you',
      'advanced_filters',
      'priority_matching',
      'boost_profile',
    ],
  },
  '6months': {
    id: '6months',
    rank: 5,
    name: '6 Months Premium',
    label: '6 months',
    duration: 180,
    price: 59.99, // ~ $9.99/mo
    currency: 'USD',
    period: 'mo',
    savings: 'Save 50%',
    monthlyPrice: 9.99,
    features: [
      'unlimited_likes',
      'see_who_liked_you',
      'advanced_filters',
      'priority_matching',
      'boost_profile',
      'undo_swipe',
    ],
  },
};

/**
 * Get plan details by ID
 */
export function getPlanDetails(planId) {
  return SUBSCRIPTION_PLANS[planId] || null;
}

/**
 * Get all available plans
 */
export function getAllPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

/**
 * Calculate savings percentage
 */
export function calculateSavings(planId) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan || !plan.monthlyPrice) return null;

  const monthlyPlan = SUBSCRIPTION_PLANS['1month'];
  if (!monthlyPlan) return null;

  const savings =
    ((monthlyPlan.price - plan.monthlyPrice) / monthlyPlan.price) * 100;
  return Math.round(savings);
}
