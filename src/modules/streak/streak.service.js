import Streak from './streak.model.js';
import Match from '../../models/Match.js';
import streakNotification from './streak.notification.js';
import {emitToUser} from '../../services/socketService.js';
import fs from 'fs';
import path from 'path';

const logFile = 'D:\\Mohit_pryvo\\Dating_App\\server\\streak_debug.log';
const log = msg => {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(msg);
  } catch (e) {
    console.error('Log failed', e);
  }
};

class StreakService {
  /**
   * Get sorted userPairId for any two users
   */
  getUserPairId(userAId, userBId) {
    const ids = [userAId.toString(), userBId.toString()].sort();
    return `${ids[0]}_${ids[1]}`;
  }

  /**
   * Broadcast streak update via socket
   */
  broadcastUpdate(fromUserId, toUserId, streak) {
    const data = {
      userPairId: streak.userPairId,
      streakCount: streak.streakCount,
      lastActivityDate: streak.lastActivityDate,
      graceUsed: streak.graceUsed,
    };
    emitToUser(fromUserId.toString(), 'streak:update', data);
    emitToUser(toUserId.toString(), 'streak:update', data);
  }

  /**
   * Process an engagement activity between two users
   */
  async handleEngagement(fromUserId, toUserId, type) {
    const flag = process.env.FEATURE_STREAK_ENABLED;
    log(
      `[Streak] Triggered: ${type} engagement (${fromUserId} -> ${toUserId}). Flag: [${flag}]`,
    );

    // Fallback to true if undefined, but respect explicit 'false'
    if (flag !== undefined && flag !== 'true') {
      log(
        `[Streak] Aborting: FEATURE_STREAK_ENABLED is explicitly set to [${flag}]`,
      );
      return;
    }

    try {
      log(
        `[Streak] Processing ${type} engagement: ${fromUserId} -> ${toUserId}`,
      );
      const userPairId = this.getUserPairId(fromUserId, toUserId);
      const now = new Date();
      const todayUtc = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );

      // Ensure we are working with string IDs for consistency
      const fromIdStr = fromUserId.toString();
      const toIdStr = toUserId.toString();

      log(`[Streak] Checking match for: ${fromIdStr} & ${toIdStr}`);

      // Find match to ensure they are actually matched
      const match = await Match.findOne({
        users: {$all: [fromIdStr, toIdStr]},
      });

      if (!match) {
        log(
          `[Streak] Interaction blocked: Users ${fromIdStr} and ${toIdStr} are NOT matched in DB.`,
        );
        return;
      }

      log(
        `[Streak] Match found (${match._id}). Checking streak for: ${userPairId}`,
      );

      // Atomic update to prevent race conditions and enforce daily idempotency
      let streak = await Streak.findOne({userPairId});

      if (!streak) {
        log(`[Streak] No streak exists. Creating one...`);
        // Initial creation set streak to 1
        streak = await Streak.create({
          userA: [fromIdStr, toIdStr].sort()[0],
          userB: [fromIdStr, toIdStr].sort()[1],
          userPairId,
          streakCount: 1,
          lastActivityDate: now,
          graceUsed: false,
        });
        log(`[Streak] Created new streak for pair ${userPairId} with count 1`);

        // Optional: send notification for starting streak
        await streakNotification.sendIncrement(
          fromUserId,
          toUserId,
          streak.streakCount,
        );
        await streakNotification.sendIncrement(
          toUserId,
          fromUserId,
          streak.streakCount,
        );
        this.broadcastUpdate(fromUserId, toUserId, streak);
        return streak;
      }

      log(
        `[Streak] Existing streak found. Count: ${streak.streakCount}, Last Activity: ${streak.lastActivityDate}`,
      );

      const lastActivity = streak.lastActivityDate;
      const lastActivityUtc = lastActivity
        ? new Date(
            Date.UTC(
              lastActivity.getUTCFullYear(),
              lastActivity.getUTCMonth(),
              lastActivity.getUTCDate(),
            ),
          )
        : null;

      // 1. Same-day activity (idempotency check)
      if (lastActivityUtc && lastActivityUtc.getTime() === todayUtc.getTime()) {
        log(
          `[Streak] Pair ${userPairId} already had activity today. Skipping increment.`,
        );
        return streak;
      }

      // 2. Rolling 24-hour window check
      const diffInHours = (now - lastActivity) / (1000 * 60 * 60);
      log(
        `[Streak] Diff in hours since last activity: ${diffInHours.toFixed(
          2,
        )}h`,
      );

      if (diffInHours <= 24) {
        // Increment streak
        streak.streakCount += 1;
        streak.lastActivityDate = now;
        // Important: we don't reset graceUsed here, it resets on manual reset or when streak breaks
        await streak.save();

        log(
          `[Streak] Incremented streak for pair ${userPairId} to ${streak.streakCount}`,
        );
        await streakNotification.sendIncrement(
          fromUserId,
          toUserId,
          streak.streakCount,
        );
        await streakNotification.sendIncrement(
          toUserId,
          fromUserId,
          streak.streakCount,
        );
      } else {
        // Streak broken - check for grace
        if (!streak.graceUsed) {
          streak.graceUsed = true;
          streak.lastActivityDate = now; // Give another 24h from now
          streak.streakCount += 1; // Count the activity as the "next" day in grace
          await streak.save();
          log(`[Streak] Grace period applied for pair ${userPairId}`);
        } else {
          // Reset streak
          streak.streakCount = 1;
          streak.lastActivityDate = now;
          streak.graceUsed = false; // Reset grace status for new cycle
          await streak.save();
          log(`[Streak] Streak reset for pair ${userPairId}`);
          await streakNotification.sendReset(fromUserId, toUserId);
          await streakNotification.sendReset(toUserId, fromUserId);
        }
      }

      if (streak) {
        this.broadcastUpdate(fromUserId, toUserId, streak);
      }
      return streak;
    } catch (error) {
      log(`[Streak] Service Error in handleEngagement: ${error.message}`);
      if (error.stack) log(`[Streak] Stack: ${error.stack}`);
    }
  }

  /**
   * Get leaderboard for top streaks
   */
  async getLeaderboard(limit = 50) {
    try {
      return await Streak.find({}).sort({streakCount: -1}).limit(limit).lean();
    } catch (error) {
      console.error('[Streak] Leaderboard Error:', error);
      return [];
    }
  }

  /**
   * Get all streaks for a user
   */
  async getUserStreaks(userId) {
    try {
      return await Streak.find({
        $or: [{userA: userId.toString()}, {userB: userId.toString()}],
      }).lean();
    } catch (error) {
      console.error('[Streak] User Streaks Error:', error);
      return [];
    }
  }

  /**
   * Get streak between two users
   */
  async getPairStreak(userAId, userBId) {
    try {
      const userPairId = this.getUserPairId(userAId, userBId);
      return await Streak.findOne({userPairId}).lean();
    } catch (error) {
      console.error('[Streak] Pair Streak Error:', error);
      return null;
    }
  }
}
export default new StreakService();
