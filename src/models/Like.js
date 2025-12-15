import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Like", LikeSchema);
