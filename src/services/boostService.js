/**
 * Boost Profile Service
 * Handles profile boosting functionality for premium users
 */

import Boost from '../models/Boost.js';
import {isUserPremium} from '../models/Subscription.js';

/**
 * Create a new boost for a user
 * @param {string} userId - User ID
 * @param {number} duration - Duration in minutes (default: 30)
 * @returns {object} Boost object
 */
export async function createBoost(userId, duration = 30) {
  // Check if user is premium
  const premium = await isUserPremium(userId);
  if (!premium) {
    throw new Error('Boost is only available for premium users');
  }

  // Check if user already has an active boost
  const activeBoost = await Boost.getActiveBoost(userId);
  if (activeBoost) {
    throw new Error('You already have an active boost');
  }

  // Create new boost
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  const boost = new Boost({
    userId,
    startTime,
    endTime,
    duration,
    isActive: true,
  });

  await boost.save();

  return boost;
}

/**
 * Get active boost for a user
 * @param {string} userId - User ID
 * @returns {object|null} Active boost or null
 */
export async function getActiveBoost(userId) {
  return Boost.getActiveBoost(userId);
}

/**
 * Check if a user currently has an active boost
 * @param {string} userId - User ID
 * @returns {boolean} True if user has active boost
 */
export async function hasActiveBoost(userId) {
  const boost = await Boost.getActiveBoost(userId);
  return !!boost;
}

/**
 * Get boost history for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of boosts to return
 * @returns {array} Array of boost objects
 */
export async function getBoostHistory(userId, limit = 10) {
  return Boost.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Expire old boosts (should be run as a cron job)
 */
export async function expireOldBoosts() {
  return Boost.expireOldBoosts();
}

