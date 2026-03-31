import mongoose from 'mongoose';

/**
 * Notification model for logging and scheduling push notifications.
 */
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
    /**
     * Notification categories.
     * "timer" is used for real-time interaction countdowns.
     */
    type: {
      type: String,
      enum: ['normal', 'persistent', 'timer', 'promo', 'announcement'],
      default: 'normal',
    },
    /**
     * Targeting audience.
     */
    audience: {
      type: String,
      enum: ['all', 'premium', 'free', 'custom', 'Premium', 'Free'], // Supporting both cases seen in diffs
      required: true,
    },
    /**
     * List of target user IDs (for audience='custom').
     */
    userIds: [{
      type: String, // Matching UUID string ID system
    }],
    /**
     * Flexible JSON object for the payload data.
     * For type="timer", this contains { type, endTime, actionText }.
     */
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /** High priority flag for FCM */
    isHighPriority: {
      type: Boolean,
      default: false,
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
    recipientCount: {
      type: Number,
      default: 0,
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

// Index for scheduler and filtering
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ type: 1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
