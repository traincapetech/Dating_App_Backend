import mongoose from 'mongoose';

const MatchSchema = new mongoose.Schema({
  users: [{type: String, required: true}], // [userA, userB]
  createdAt: {type: Date, default: Date.now},
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000),
  }, // Default 7 days from now
  dateScheduled: {type: Date, default: null},
  status: {
    type: String,
    enum: ['active', 'expired', 'secured'],
    default: 'active',
  },
  chatEnabled: {type: Boolean, default: true},
  callEnabled: {type: Boolean, default: true},
  lastMessageAt: {type: Date, default: Date.now},
});

export default mongoose.model('Match', MatchSchema);