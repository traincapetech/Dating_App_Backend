import express from 'express';
import { getIcebreakerSuggestions, trackIcebreakerAction } from '../controllers/icebreakerController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/icebreaker?targetUserId=xxx&matchId=yyy&tone=flirty|funny
router.get('/', getIcebreakerSuggestions);

// POST /api/icebreaker/track-action
router.post('/track-action', trackIcebreakerAction);

export default router;
