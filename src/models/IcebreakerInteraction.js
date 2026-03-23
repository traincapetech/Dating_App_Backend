import mongoose from 'mongoose';

const IcebreakerInteractionSchema = new mongoose.Schema({
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  matchId: { type: String, required: true },
  suggestions: [{ type: String }],
  tone: { type: String, enum: ['flirty', 'funny'] },
  shownAt: { type: Date, default: Date.now },
  clickedAt: { type: Date },
  clickedValue: { type: String },
  replyReceived: { type: Boolean, default: false },
  repliedAt: { type: Date }
});

IcebreakerInteractionSchema.index({ senderId: 1, receiverId: 1 });

export default mongoose.model('IcebreakerInteraction', IcebreakerInteractionSchema);
