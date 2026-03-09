import mongoose from 'mongoose';

/**
 * Streak Schema
 *
 * Tracks mutual engagement streaks between two matched users.
 *
 * Mutual participation is tracked via:
 *  - participationA  : boolean — has userA performed a qualifying action this cycle?
 *  - participationB  : boolean — has userB performed a qualifying action this cycle?
 *
 * A "cycle" resets (both flags → false) after streak is incremented.
 *
 * The streak resets to 0 when more than 24 hours pass since the last
 * successful mutual interaction (lastMutualInteractionAt).
 *
 * Warning notifications are sent at the 20-22 hour mark.
 */
const StreakSchema = new mongoose.Schema(
  {
    // Sorted, underscore-joined pair of user IDs (primary key)
    userPairId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userA: {type: String, required: true, index: true},
    userB: {type: String, required: true, index: true},

    // The current streak count (days of consecutive mutual engagement)
    streakCount: {type: Number, default: 0},

    // Timestamp of the last SUCCESSFUL mutual interaction (used for expiry checks)
    lastMutualInteractionAt: {type: Date, default: null, index: true},

    // Per-cycle participation flags: reset to false after each increment
    participationA: {type: Boolean, default: false},
    participationB: {type: Boolean, default: false},

    // Whether the warning notification has been sent for the current cycle
    warningSent: {type: Boolean, default: false},
  },
  {timestamps: true},
);

const modelName = 'UserStreak';
const Streak =
  mongoose.models[modelName] || mongoose.model(modelName, StreakSchema);

export default Streak;
