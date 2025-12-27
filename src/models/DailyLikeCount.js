import mongoose from "mongoose";

const DailyLikeCountSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  count: { type: Number, default: 0 },
  lastResetAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Compound index for efficient queries
DailyLikeCountSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyLikeCount", DailyLikeCountSchema);

