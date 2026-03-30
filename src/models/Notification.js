import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['normal', 'persistent'],
      default: 'normal',
    },
    audience: {
      type: String,
      enum: ['all', 'premium', 'free', 'custom'],
      required: true,
    },
    userIds: [{
      type: String, // Matching existing UUID string ID system
    }],
    data: {
      type: Map,
      of: String,
    },
    scheduledAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'sending', 'sent', 'failed'],
      default: 'pending',
    },
    stats: {
      totalSent: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: {
      type: String, // Admin ID
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for scheduler
notificationSchema.index({ status: 1, scheduledAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
