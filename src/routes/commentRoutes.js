import express from 'express';
import {
  sendComment,
  getReceivedComments,
  getSentComments,
  respondToComment,
  markCommentRead,
  getUnreadCommentCount,
  deleteComment,
} from '../controllers/commentController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();
router.use(requireAuth);

// Send a comment/icebreaker to another user
router.post('/', sendComment);

// Get comments received by the user
router.get('/received/:userId', getReceivedComments);

// Get comments sent by the user
router.get('/sent/:userId', getSentComments);

// Get unread comment count
router.get('/unread-count/:userId', getUnreadCommentCount);

// Respond to a comment (accept/reject)
router.post('/:commentId/respond', respondToComment);

// Mark comment as read
router.put('/:commentId/read', markCommentRead);

// Delete a pending comment
router.delete('/:commentId', deleteComment);

export default router;
