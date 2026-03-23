import express from 'express';
import { getIcebreakerSuggestions, trackIcebreakerAction } from '../controllers/icebreakerController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/icebreaker?targetUserId=xxx&matchId=yyy&tone=flirty|funny
router.get('/', authenticate, getIcebreakerSuggestions);

// POST /api/icebreaker/track-action
router.post('/track-action', authenticate, trackIcebreakerAction);

export default router;
