import Streak from './streak.model.js';
import streakNotification from './streak.notification.js';

class StreakCron {
  /**
   * Run the hourly streak check
   */
  async runHourlyTask() {
    if (process.env.FEATURE_STREAK_ENABLED !== 'true') return;

    console.log('[Streak Cron] Running hourly streak check...');
    const now = new Date();

    try {
      // 1. Find streaks where inactivity is between 20 and 22 hours
      // Only notify if they haven't been notified (we can check by lastActivityDate or something else)
      // But let's just use simple time range for now
      const warningLimitMin = new Date(now.getTime() - 22 * 60 * 60 * 1000);
      const warningLimitMax = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const warningStreaks = await Streak.find({
        lastActivityDate: {$gte: warningLimitMin, $lte: warningLimitMax},
        streakCount: {$gt: 0},
        // Optional: we could add a field to avoid double warning, but hourly is mostly safe
      });

      for (const streak of warningStreaks) {
        await streakNotification.sendWarning(streak.userA, streak.userB);
        await streakNotification.sendWarning(streak.userB, streak.userA);
      }

      // 2. Find streaks where inactivity is >= 24 hours
      // Reset streak and send notice
      const resetLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const brokenStreaks = await Streak.find({
        lastActivityDate: {$lte: resetLimit},
        streakCount: {$gt: 0},
      });

      for (const streak of brokenStreaks) {
        // Check if grace period is available
        if (!streak.graceUsed) {
          // Apply grace (essentially delay the reset by 24h)
          streak.graceUsed = true;
          // Move the lastActivityDate "forward" to effectively give one more day?
          // Actually, let's just not reset, but mark graceUsed.
          // If they don't engage for another 24h, then reset.
          // This means we might need a separate grace field or just rely on this logic.
          // But if we don't move lastActivityDate, it will keep hitting this block every hour.
          // So we must move it or mark that grace was already applied *once* for this specific reset cycle.
          streak.lastActivityDate = new Date(
            streak.lastActivityDate.getTime() + 24 * 60 * 60 * 1000,
          );
          await streak.save();
          console.log(
            `[Streak Cron] Grace applied for pair ${streak.userPairId}`,
          );
        } else {
          // Truly broken
          streak.streakCount = 0;
          streak.graceUsed = false; // Reset grace state for next cycle
          await streak.save();
          console.log(
            `[Streak Cron] Streak reset for pair ${streak.userPairId}`,
          );
          await streakNotification.sendReset(streak.userA, streak.userB);
          await streakNotification.sendReset(streak.userB, streak.userA);
        }
      }

      console.log(
        `[Streak Cron] Processed ${warningStreaks.length} warnings and ${brokenStreaks.length} resets/graces.`,
      );
    } catch (error) {
      console.error('[Streak Cron] Task error:', error);
    }
  }
}

export default new StreakCron();
