/**
 * Subscription Plans Configuration
 * Update prices here - they will be used across the application
 */

export const SUBSCRIPTION_PLANS = {
  '1week': {
    id: '1week',
    name: '1 Week Premium',
    label: '1 week',
    duration: 7, // days
    price: 899,
    currency: 'INR',
    period: 'wk',
    features: ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'priority_matching'],
  },
  '1month': {
    id: '1month',
    name: '1 Month Premium',
    label: '1 month',
    duration: 30,
    price: 1699,
    currency: 'INR',
    period: 'mo',
    popular: true,
    features: ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'priority_matching'],
  },
  '3months': {
    id: '3months',
    name: '3 Months Premium',
    label: '3 months',
    duration: 90,
    price: 3499, // Total for 3 months
    currency: 'INR',
    period: 'mo',
    savings: 'Save 50%',
    monthlyPrice: 1166.33,
    features: ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'priority_matching', 'boost_profile'],
  },
  '6months': {
    id: '6months',
    name: '6 Months Premium',
    label: '6 months',
    duration: 180,
    price: 4899, // Total for 6 months
    currency: 'INR',
    period: 'mo',
    savings: 'Save 79%',
    monthlyPrice: 816.5,
    features: ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'priority_matching', 'boost_profile', 'undo_swipe'],
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
  
  const savings = ((monthlyPlan.price - plan.monthlyPrice) / monthlyPlan.price) * 100;
  return Math.round(savings);
}

