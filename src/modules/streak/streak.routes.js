import express from 'express';
import {
  getLeaderboard,
  getUserStreaks,
  getPairStreak,
} from './streak.controller.js';

import {requireAuth} from '../../middlewares/auth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/streak/leaderboard
router.get('/leaderboard', getLeaderboard);

// GET /api/streak/user?userId=...
router.get('/user', getUserStreaks);

// GET /api/streak/pair?userId=...&partnerId=...
router.get('/pair', getPairStreak);

export default router;
