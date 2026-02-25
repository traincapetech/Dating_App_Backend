import mongoose from 'mongoose';

const BlockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true, index: true },
  blockedId: { type: String, required: true, index: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for efficient lookup
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export default mongoose.model('Block', BlockSchema);

