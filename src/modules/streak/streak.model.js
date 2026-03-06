import mongoose from 'mongoose';

const StreakSchema = new mongoose.Schema(
  {
    userPairId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userA: {
      type: String,
      required: true,
      index: true,
    },
    userB: {
      type: String,
      required: true,
      index: true,
    },
    streakCount: {
      type: Number,
      default: 0,
    },
    lastActivityDate: {
      type: Date,
      default: null,
      index: true,
    },
    graceUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Avoid re-definition error in development with hot-reloading
const modelName = 'UserStreak';
const Streak =
  mongoose.models[modelName] || mongoose.model(modelName, StreakSchema);

export default Streak;
