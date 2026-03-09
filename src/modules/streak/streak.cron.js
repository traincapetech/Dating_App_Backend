import Streak from './streak.model.js';
import streakNotification from './streak.notification.js';
import streakService from './streak.service.js';

/**
 * StreakCron
 *
 * Runs hourly. Checks all active streaks and:
 *   1. Sends a WARNING notification when 20–22 hours have passed without
 *      a mutual interaction (so users know their streak is about to break).
 *   2. RESETS the streak to 0 when 24+ hours have passed with no mutual
 *      interaction.
 */
class StreakCron {
  async runHourlyTask() {
    if (process.env.FEATURE_STREAK_ENABLED !== 'true') return;

    console.log('[Streak Cron] Running hourly check...');
    const now = new Date();

    try {
      // ── 1. Warning: 20–22 hours since last mutual interaction ──────────
      const warnMin = new Date(now.getTime() - 22 * 60 * 60 * 1000);
      const warnMax = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const warningStreaks = await Streak.find({
        streakCount: {$gt: 0},
        lastMutualInteractionAt: {$gte: warnMin, $lte: warnMax},
        warningSent: {$ne: true},
      });

      for (const streak of warningStreaks) {
        await streakNotification.sendWarning(streak.userA, streak.userB);
        await streakNotification.sendWarning(streak.userB, streak.userA);
        streak.warningSent = true;
        await streak.save();
        console.log(`[Streak Cron] Warning sent for pair ${streak.userPairId}`);
      }

      // ── 2. Reset: 24+ hours since last mutual interaction ──────────────
      const resetCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const expiredStreaks = await Streak.find({
        streakCount: {$gt: 0},
        lastMutualInteractionAt: {$lt: resetCutoff},
      });

      for (const streak of expiredStreaks) {
        const oldCount = streak.streakCount;
        streak.streakCount = 0;
        streak.participationA = false;
        streak.participationB = false;
        streak.warningSent = false;
        await streak.save();

        console.log(
          `[Streak Cron] Reset ${streak.userPairId} (was ${oldCount}) — ` +
            `last mutual: ${streak.lastMutualInteractionAt}`,
        );

        await streakNotification.sendReset(streak.userA, streak.userB);
        await streakNotification.sendReset(streak.userB, streak.userA);
      }

      console.log(
        `[Streak Cron] Done. Warnings: ${warningStreaks.length}, Resets: ${expiredStreaks.length}`,
      );
    } catch (err) {
      console.error('[Streak Cron] Error:', err);
    }
  }
}

export default new StreakCron();
