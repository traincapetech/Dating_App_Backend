import mongoose from 'mongoose';

const boostSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endTime: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
    default: 30, // 30 minutes default
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
boostSchema.index({ userId: 1, isActive: 1 });
boostSchema.index({ endTime: 1, isActive: 1 });

// Method to check if boost is currently active
boostSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.isActive && now >= this.startTime && now <= this.endTime;
};

// Static method to get active boosts for a user
boostSchema.statics.getActiveBoost = async function(userId) {
  const now = new Date();
  return this.findOne({
    userId,
    isActive: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
  });
};

// Static method to expire old boosts
boostSchema.statics.expireOldBoosts = async function() {
  const now = new Date();
  return this.updateMany(
    {
      isActive: true,
      endTime: { $lt: now },
    },
    {
      $set: { isActive: false },
    }
  );
};

const Boost = mongoose.models.Boost || mongoose.model('Boost', boostSchema);

export default Boost;

