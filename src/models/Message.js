import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  matchId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  text: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ['image', 'video', null], default: null },
  timestamp: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['sent', 'delivered', 'seen'], 
    default: 'sent' 
  },
  seenAt: { type: Date },
  // For soft delete (hidden messages)
  hiddenFor: [{ type: String }]
});

// Index for efficient message queries
MessageSchema.index({ matchId: 1, timestamp: 1 });
MessageSchema.index({ receiverId: 1, status: 1 });

export default mongoose.model("Message", MessageSchema);
