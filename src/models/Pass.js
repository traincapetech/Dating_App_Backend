import mongoose from 'mongoose';

const PassSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  passedUserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Pass', PassSchema);
