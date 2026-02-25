import mongoose from 'mongoose';

/**
 * ProfileComment Model
 * Hinge-style comments on profiles - users can leave comments/icebreakers
 * on other users' photos or prompt answers
 */
const ProfileCommentSchema = new mongoose.Schema({
  // Who left the comment
  senderId: { type: String, required: true, index: true },

  // Who the comment is for
  receiverId: { type: String, required: true, index: true },

  // The comment content
  comment: {
    type: String,
    required: true,
    maxlength: 500,
  },

  // What the comment is about (optional context)
  targetContent: {
    type: { type: String, enum: ['photo', 'prompt', 'profile'], default: 'profile' },
    photoIndex: { type: Number },     // Which photo (0-based index)
    photoUrl: { type: String },       // URL of the photo
    promptId: { type: String },       // ID of the prompt
    promptQuestion: { type: String }, // The prompt question
    promptAnswer: { type: String },   // The answer they commented on
  },

  // Status of the comment
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
  },

  // Whether receiver has read it
  isRead: { type: Boolean, default: false },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
  expiresAt: { type: Date }, // Comments can expire after 7 days if not responded
});

// Compound index for efficient queries
ProfileCommentSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
ProfileCommentSchema.index({ senderId: 1, createdAt: -1 });

export default mongoose.model('ProfileComment', ProfileCommentSchema);
