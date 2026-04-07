import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  matchId: {type: String, required: true, index: true},
  senderId: {type: String, required: true},
  receiverId: {type: String, required: true},
  text: {type: String},
  mediaUrl: {type: String},
  mediaType: {
    type: String,
    enum: ['image', 'video', 'gif', 'gift', null],
    default: null,
  },
  giftMetadata: {
    giftId: {type: mongoose.Schema.Types.ObjectId, ref: 'Gift'},
    name: String,
    slug: String,
    coinValue: Number,
    imageUrl: String,
  },
  timestamp: {type: Date, default: Date.now},
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent',
  },
  seenAt: {type: Date},
  // For soft delete (hidden messages)
  hiddenFor: [{type: String}],
});

// Index for efficient message queries
MessageSchema.index({matchId: 1, timestamp: 1});
MessageSchema.index({receiverId: 1, status: 1});

// Automate streak tracking
MessageSchema.post('save', async function (doc) {
  try {
    // Import dynamically to avoid circular dependencies
    const {default: streakService} = await import(
      '../modules/streak/streak.service.js'
    );
    if (streakService && streakService.handleEngagement) {
      await streakService.handleEngagement(
        doc.senderId,
        doc.receiverId,
        'message',
      );
    }
  } catch (err) {
    console.error('[Streak Hook Error]:', err.message);
  }
});

export default mongoose.model('Message', MessageSchema);