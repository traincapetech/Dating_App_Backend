import Like from "../models/Like.js";   
import Match from "../models/Match.js";
import Pass from "../models/Pass.js";

export const likeUser = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // Save like
    await Like.create({ senderId, receiverId });

    // Check for mutual like
    const reverseLike = await Like.findOne({
      senderId: receiverId,
      receiverId: senderId
    });

    if (reverseLike) {
      const match = await Match.create({
        users: [senderId, receiverId]
      });

      return res.json({
        success: true,
        isMatch: true,
        match
      });
    }

    res.json({ success: true, isMatch: false });

  } catch (error) {
    res.status(500).json({ message: "Error liking user", error });
  }
};

