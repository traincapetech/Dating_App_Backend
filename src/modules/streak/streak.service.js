import Streak from './streak.model.js';
import Match from '../../models/Match.js';
import streakNotification from './streak.notification.js';
import {emitToUser} from '../../services/socketService.js';

/**
 * StreakService
 *
 * Core logic for mutual-engagement streak tracking.
 *
 * HOW MUTUAL PARTICIPATION WORKS:
 * ─────────────────────────────────────────────────────────────────────────
 * Each pair has two boolean flags: participationA and participationB.
 *
 * When userA performs a qualifying action  → participationA = true
 * When userB performs a qualifying action  → participationB = true
 *
 * When BOTH flags become true in the same 24-hour window:
 *   1. Check if 24h have passed since lastMutualInteractionAt → if yes, reset to 1
 *   2. Otherwise increment streakCount by 1
 *   3. Update lastMutualInteractionAt = now
 *   4. Reset participationA = false, participationB = false  (start fresh cycle)
 *
 * The streak RESETS to 0 (handled by the hourly cron) when:
 *   now - lastMutualInteractionAt > 24 hours  AND  streakCount > 0
 *
 * Qualifying activities: chat, like, comment, gift (and any future types)
 * ─────────────────────────────────────────────────────────────────────────
 */
class StreakService {
  // ─── helpers ───────────────────────────────────────────────────────────

  /** Stable, sorted pair key (always lowercase) */
  getUserPairId(user1, user2) {
    return [user1.toString().toLowerCase(), user2.toString().toLowerCase()]
      .sort()
      .join('_');
  }

  /** Push streak update to both users via socket */
  broadcastUpdate(userAId, userBId, streak) {
    const payload = {
      userPairId: streak.userPairId,
      streakCount: streak.streakCount,
      lastMutualInteractionAt: streak.lastMutualInteractionAt,
    };
    emitToUser(userAId.toString(), 'streak:update', payload);
    emitToUser(userBId.toString(), 'streak:update', payload);
  }

  // ─── main entry point ──────────────────────────────────────────────────

  /**
   * Called whenever a user performs a qualifying action toward another user.
   *
   * @param {string} fromUserId  - User who performed the action
   * @param {string} toUserId    - User who is the target
   * @param {string} type        - 'chat' | 'like' | 'comment' | 'gift' | 'match'
   */
  async handleEngagement(fromUserId, toUserId, type) {
    // Respect feature flag (default ON when unset)
    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') return;

    try {
      const fromStr = fromUserId.toString().toLowerCase();
      const toStr = toUserId.toString().toLowerCase();
      const pairId = this.getUserPairId(fromStr, toStr);
      const now = new Date();

      console.log(
        `[Streak] ${type.toUpperCase()} | ${fromStr} → ${toStr} | pair=${pairId}`,
      );

      // ── Verify the two users are actually matched ──────────────────────
      const match = await Match.findOne({users: {$all: [fromStr, toStr]}});
      if (!match) {
        console.log(`[Streak] No match found for ${pairId}. Skipping.`);
        return;
      }

      // ── Upsert streak document ─────────────────────────────────────────
      let streak = await Streak.findOne({userPairId: pairId});

      if (!streak) {
        // First ever interaction for this pair
        const [a, b] = [fromStr, toStr].sort();
        streak = await Streak.create({
          userPairId: pairId,
          userA: a,
          userB: b,
          streakCount: 0,
          lastMutualInteractionAt: null,
          participationA: false,
          participationB: false,
        });
        console.log(`[Streak] Created new record for ${pairId}`);
      }

      // ── Special case: a new "match" event counts as BOTH sides acting ──
      if (type === 'match') {
        streak.streakCount = 1;
        streak.lastMutualInteractionAt = now;
        streak.participationA = false;
        streak.participationB = false;
        streak.warningSent = false;
        await streak.save();
        console.log(`[Streak] Match event → streak starts at 1 for ${pairId}`);
        this.broadcastUpdate(fromStr, toStr, streak);
        return streak;
      }

      // ── Check for 24-hour expiry BEFORE recording participation ────────
      // If more than 24 hours have passed since the last mutual interaction,
      // the streak is expired. Reset it to 0 and clear participation flags
      // so the upcoming activity starts a fresh cycle.
      if (streak.streakCount > 0 && streak.lastMutualInteractionAt) {
        const hoursElapsed =
          (now - new Date(streak.lastMutualInteractionAt)) / (1000 * 60 * 60);

        if (hoursElapsed > 24) {
          console.log(
            `[Streak] ⚠️  ${hoursElapsed.toFixed(
              1,
            )}h since last mutual interaction ` + `— resetting ${pairId} to 0.`,
          );
          streak.streakCount = 0;
          streak.participationA = false;
          streak.participationB = false;
          streak.warningSent = false;
          // lastMutualInteractionAt stays so the cron can still clean it up,
          // but it will be overwritten when they form mutual interaction again.
        }
      }

      // ── Record this user's participation ──────────────────────────────
      const isUserA = fromStr === streak.userA;
      if (isUserA) {
        streak.participationA = true;
        console.log(`[Streak] participationA=true for ${pairId}`);
      } else {
        streak.participationB = true;
        console.log(`[Streak] participationB=true for ${pairId}`);
      }

      // ── Check if BOTH users have now participated ──────────────────────
      if (streak.participationA && streak.participationB) {
        // Both sides are in — increment!
        streak.streakCount += 1;
        streak.lastMutualInteractionAt = now;
        streak.participationA = false; // ← reset for next cycle
        streak.participationB = false; // ← reset for next cycle
        streak.warningSent = false;
        await streak.save();

        console.log(
          `[Streak] 🔥 Mutual interaction! ${pairId} → streakCount=${streak.streakCount}`,
        );

        // Notify both users
        await streakNotification.sendIncrement(
          fromStr,
          toStr,
          streak.streakCount,
        );
        await streakNotification.sendIncrement(
          toStr,
          fromStr,
          streak.streakCount,
        );
        this.broadcastUpdate(fromStr, toStr, streak);
      } else {
        // Only one side so far; save and wait for the other
        await streak.save();
        console.log(
          `[Streak] 👤 Participation recorded for ${fromStr}. ` +
            `Waiting for ${toStr} to act. ` +
            `(A=${streak.participationA}, B=${streak.participationB})`,
        );
      }

      return streak;
    } catch (err) {
      console.error('[Streak] handleEngagement error:', err.message, err.stack);
    }
  }

  // ─── expiry helper (used by cron and API) ──────────────────────────────

  /**
   * Returns true when a streak is expired (24h+ without mutual interaction).
   * A streak with count 0 is treated as already reset.
   */
  isExpired(streak) {
    if (!streak || streak.streakCount <= 0) return true;
    if (!streak.lastMutualInteractionAt) return true;
    const hrs =
      (Date.now() - new Date(streak.lastMutualInteractionAt).getTime()) /
      (1000 * 60 * 60);
    return hrs > 24;
  }

  // ─── API helpers ────────────────────────────────────────────────────────

  async getLeaderboard(limit = 10) {
    try {
      const all = await Streak.find({streakCount: {$gt: 0}})
        .sort({streakCount: -1})
        .limit(limit * 3)
        .lean();

      const activeStreaks = all.filter(s => !this.isExpired(s)).slice(0, limit);

      const User = (await import('../../models/User.js')).default;
      const Profile = (await import('../../models/Profile.js')).default;

      const enriched = await Promise.all(
        activeStreaks.map(async streak => {
          try {
            const userADoc = await User.findById(streak.userA).lean();
            const userBDoc = await User.findById(streak.userB).lean();

            const profileA = await Profile.findOne({
              userId: streak.userA,
            }).lean();
            const profileB = await Profile.findOne({
              userId: streak.userB,
            }).lean();

            const nameA =
              profileA?.basicInfo?.firstName || userADoc?.fullName || 'Unknown';
            const nameB =
              profileB?.basicInfo?.firstName || userBDoc?.fullName || 'Unknown';

            const photoA =
              profileA?.media?.media?.[0]?.url ||
              'https://ui-avatars.com/api/?background=667eea&color=fff&name=' +
                encodeURIComponent(nameA);
            const photoB =
              profileB?.media?.media?.[0]?.url ||
              'https://ui-avatars.com/api/?background=667eea&color=fff&name=' +
                encodeURIComponent(nameB);

            return {
              userPairId: streak.userPairId,
              streakCount: streak.streakCount,
              lastMutualInteractionAt: streak.lastActivityDate,
              userA: {
                id: streak.userA,
                name: nameA,
                photo: photoA,
              },
              userB: {
                id: streak.userB,
                name: nameB,
                photo: photoB,
              },
            };
          } catch (e) {
            console.error('[Streak] Error enriching leaderboard entry:', e);
            return streak;
          }
        }),
      );

      return enriched;
    } catch (err) {
      console.error('[Streak] Leaderboard error:', err);
      return [];
    }
  }

  async getUserStreaks(userId) {
    try {
      const id = userId.toString().toLowerCase();
      const rows = await Streak.find({
        $or: [{userA: id}, {userB: id}],
      }).lean();
      // Return all — include expired ones with streakCount mapped to 0
      return rows.map(s => (this.isExpired(s) ? {...s, streakCount: 0} : s));
    } catch (err) {
      console.error('[Streak] getUserStreaks error:', err);
      return [];
    }
  }

  async getPairStreak(userAId, userBId) {
    try {
      const pairId = this.getUserPairId(userAId, userBId);
      const streak = await Streak.findOne({userPairId: pairId}).lean();
      if (!streak) return null;
      return this.isExpired(streak) ? {...streak, streakCount: 0} : streak;
    } catch (err) {
      console.error('[Streak] getPairStreak error:', err);
      return null;
    }
  }
}

export default new StreakService();
