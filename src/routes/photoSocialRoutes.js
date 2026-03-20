import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
  toggleSocialLike, 
  addSocialComment, 
  getPhotoDetails,
  getProfileSocialStats 
} from '../controllers/photoSocialController.js';
import { requireAuth } from '../middlewares/auth.js'; 

const router = express.Router();

/**
 * ❗ Social Anti-Abuse Rate Limiting
 * Only applied to comments to prevent spam.
 */
const commentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 comments per user per minute
  message: { success: false, message: 'Too many comments - please wait a minute' },
  standardHeaders: true,
  legacyHeaders: false,
  // ❗ Fix for ERR_ERL_KEY_GEN_IPV6: Use the authenticated User ID directly
  // This is safe because requireAuth middleware ensures req.user.id exists
  keyGenerator: (req) => req.user.id,
});

// All photo social routes require authentication
router.use(requireAuth);

// POST: Toggling Likes (Atomic)
// URL: /api/photo-social/like
router.post('/like', toggleSocialLike);

// POST: Adding Comments (Rate Limited)
// URL: /api/photo-social/comment
router.post('/comment', commentLimiter, addSocialComment);

// GET: Paginated Details for Viewer
// URL: /api/photo-social/details/:photoId
router.get('/details/:photoId', getPhotoDetails);

// GET: Batch Stats for Gallery Grid
// URL: /api/photo-social/user/:userId/stats
router.get('/user/:userId/stats', getProfileSocialStats);

export default router;
