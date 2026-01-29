import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  // Hinge-style like on specific content
  likedContent: {
    type: { type: String, enum: ['profile', 'photo', 'prompt'], default: 'profile' },
    photoIndex: { type: Number }, // Index of the liked photo (0-based)
    photoUrl: { type: String },   // URL of the liked photo
    promptId: { type: String },   // ID of the prompt (e.g., 'aboutMe', 'weekendActivity')
    promptQuestion: { type: String }, // The prompt question text
    promptAnswer: { type: String },   // The answer they liked
    comment: { type: String, maxlength: 200 }, // Optional comment on the like
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Like", LikeSchema);
