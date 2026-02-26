import express from 'express';
import {
  likeUser,
  getLikesReceived,
  getLikesCount,
  getDailyLikeInfo,
} from '../controllers/likeController.js';
import {
  passUser,
  undoLastSwipe,
  getUndoStatus,
  resetPasses,
} from '../controllers/passController.js';

const router = express.Router();

// Swipe actions
router.post('/like', likeUser);
router.post('/pass', passUser);

// Undo swipe (premium only)
router.post('/undo', undoLastSwipe);
router.get('/undo-status/:userId', getUndoStatus);

// Reset passes to see profiles again
router.post('/reset-passes', resetPasses);

// Likes received
router.get('/likes/:userId', getLikesReceived);
router.get('/likes-count/:userId', getLikesCount);

// Daily like info
router.get('/daily-likes/:userId', getDailyLikeInfo);

export default router;
