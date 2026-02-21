import mongoose from 'mongoose';

const MatchSchema = new mongoose.Schema({
  users: [{type: String, required: true}], // [userA, userB]
  createdAt: {type: Date, default: Date.now},
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 3 * 24 * 60 * 60 * 1000),
  }, // Default 72 hours from now
  dateScheduled: {type: Date, default: null},
  status: {
    type: String,
    enum: ['active', 'expired', 'secured'],
    default: 'active',
  },
  chatEnabled: {type: Boolean, default: true},
  callEnabled: {type: Boolean, default: true},
});

export default mongoose.model('Match', MatchSchema);
