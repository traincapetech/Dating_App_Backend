import mongoose from "mongoose";

const MatchSchema = new mongoose.Schema({
  users: [{ type: String, required: true }], // [userA, userB]
  createdAt: { type: Date, default: Date.now },
  chatEnabled: { type: Boolean, default: true },
  callEnabled: { type: Boolean, default: true }
});

export default mongoose.model("Match", MatchSchema);
