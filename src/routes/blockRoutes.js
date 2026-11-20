import express from 'express';
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  checkBlocked,
  reportUser,
  blockAndReport,
} from '../controllers/blockController.js';

import {requireAuth} from '../middlewares/auth.js';

const router = express.Router();
router.use(requireAuth);

// Block a user
router.post('/block', blockUser);

// Unblock a user
router.post('/unblock', unblockUser);

// Get blocked users list
router.get('/blocked/:userId', getBlockedUsers);

// Check if blocked
router.get('/check/:userId/:otherUserId', checkBlocked);

// Report a user
router.post('/report', reportUser);

// Block and report in one action
router.post('/block-and-report', blockAndReport);

export default router;

