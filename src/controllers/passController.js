import Pass from "../models/Pass.js";

export const passUser = async (req, res) => {
  try {
    const { userId, passedUserId } = req.body;
    await Pass.create({ userId, passedUserId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Error passing user", error });
  }
};
