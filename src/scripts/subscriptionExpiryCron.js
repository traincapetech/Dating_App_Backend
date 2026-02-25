/**
 * Subscription Expiry Cron Job
 *
 * This script should be run daily (via cron or scheduled task) to:
 * 1. Check for expired subscriptions
 * 2. Mark them as expired
 * 3. Revoke premium status from users
 * 4. Handle payment failures
 *
 * Setup:
 * - Add to cron: 0 0 * * * node server/src/scripts/subscriptionExpiryCron.js
 * - Or use a task scheduler like node-cron, PM2, or AWS EventBridge
 */

import {processExpiredSubscriptions, syncAllPremiumStatuses} from '../services/subscriptionExpiryService.js';

async function runExpiryCron() {
  try {
    console.log(`[${new Date().toISOString()}] Starting subscription expiry process...`);

    // Process expired subscriptions
    const expiryResult = await processExpiredSubscriptions();

    console.log(`[${new Date().toISOString()}] Expiry process completed:`);
    console.log(`  - Expired: ${expiryResult.expiredCount} subscriptions`);

    // Sync all premium statuses (fix any inconsistencies)
    const syncResult = await syncAllPremiumStatuses();

    console.log(`  - Synced: ${syncResult.syncedCount} user premium statuses`);

    if (expiryResult.expiredCount > 0 || syncResult.syncedCount > 0) {
      console.log('  - Details:', JSON.stringify({
        expired: expiryResult.expired,
        synced: syncResult.synced,
      }, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in expiry cron:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExpiryCron();
}

export default runExpiryCron;

