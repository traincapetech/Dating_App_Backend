import mongoose from 'mongoose';

const PassSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  passedUserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

PassSchema.index({ userId: 1, passedUserId: 1 });

export default mongoose.model('Pass', PassSchema);
