import express from "express";
import { 
  getMessages, 
  sendMessage, 
  markMessagesSeen,
  getLastMessages 
} from "../controllers/messageController.js";

const router = express.Router();

// Get messages for a match (requires userId in headers or query)
router.get("/:matchId", getMessages);

// Send a new message
router.post("/", sendMessage);

// Mark messages as seen
router.post("/:matchId/seen", markMessagesSeen);

// Get last message for multiple matches (batch)
router.post("/last-messages", getLastMessages);

export default router;
