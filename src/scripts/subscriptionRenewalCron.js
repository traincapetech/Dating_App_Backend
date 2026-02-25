/**
 * Subscription Renewal Cron Job
 *
 * This script should be run daily (via cron or scheduled task) to:
 * 1. Check for subscriptions expiring within 24 hours
 * 2. Attempt to renew them automatically
 * 3. Update subscription status
 *
 * Setup:
 * - Add to cron: 0 0 * * * node server/src/scripts/subscriptionRenewalCron.js
 * - Or use a task scheduler like node-cron, PM2, or AWS EventBridge
 */

import {processSubscriptionRenewals} from '../services/subscriptionRenewalService.js';

async function runRenewalCron() {
  try {
    console.log(`[${new Date().toISOString()}] Starting subscription renewal process...`);

    const result = await processSubscriptionRenewals();

    console.log(`[${new Date().toISOString()}] Renewal process completed:`);
    console.log(`  - Processed: ${result.processed} subscriptions`);
    console.log('  - Results:', JSON.stringify(result.renewals, null, 2));

    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in renewal cron:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRenewalCron();
}

export default runRenewalCron;

