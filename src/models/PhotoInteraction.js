import mongoose from 'mongoose';

const PhotoInteractionSchema = new mongoose.Schema({
  senderId: { 
    type: String, 
    ref: 'User', 
    required: true 
  },
  targetUserId: { 
    type: String, 
    ref: 'User', 
    required: true 
  },
  photoId: { 
    type: String, 
    required: true,
    index: true 
  },
  photoUrl: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['like', 'comment'], 
    required: true 
  },
  text: { 
    type: String, 
    trim: true,
    maxlength: 500
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Improved indexing for aggregation and count performance
PhotoInteractionSchema.index({ targetUserId: 1, photoId: 1, type: 1 });

// Mandatory Unique constraint for Like idempotency
// This ensures a user can only have one 'like' per photo
PhotoInteractionSchema.index(
  { senderId: 1, photoId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'like' } }
);

export default mongoose.model('PhotoInteraction', PhotoInteractionSchema);
