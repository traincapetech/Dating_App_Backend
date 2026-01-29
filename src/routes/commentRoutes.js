import express from "express";
import {
  sendComment,
  getReceivedComments,
  getSentComments,
  respondToComment,
  markCommentRead,
  getUnreadCommentCount,
  deleteComment,
} from "../controllers/commentController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

// Send a comment/icebreaker to another user
router.post("/", authenticate, sendComment);

// Get comments received by the user
router.get("/received/:userId", authenticate, getReceivedComments);

// Get comments sent by the user
router.get("/sent/:userId", authenticate, getSentComments);

// Get unread comment count
router.get("/unread-count/:userId", authenticate, getUnreadCommentCount);

// Respond to a comment (accept/reject)
router.post("/:commentId/respond", authenticate, respondToComment);

// Mark comment as read
router.put("/:commentId/read", authenticate, markCommentRead);

// Delete a pending comment
router.delete("/:commentId", authenticate, deleteComment);

export default router;
