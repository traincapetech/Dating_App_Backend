/**
 * profileRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIFIED routing. All profile writes use PATCH /profile.
 * Legacy per-section POST endpoints removed completely.
 */
import {Router} from 'express';
import {
  patchProfileController,
  getProfileController,
  getAllProfilesController,
  uploadImageController,
  uploadMiddleware,
  deleteUserController,
  deleteProfileController,
  pauseProfileController,
  updateOnlineStatusController,
  getProfileInteractionsController,
  deleteImageController,
} from '../controllers/profileController.js';
import {sanitizeInput} from '../middlewares/sanitizer.js';
import {requireAuth} from '../middlewares/auth.js';

const router = Router();

// ── Single unified write endpoint for ALL profile updates ─────────────────
router.patch('/', requireAuth, sanitizeInput, patchProfileController);

// ── Media ─────────────────────────────────────────────────────────────────
router.post('/upload-image', requireAuth, uploadMiddleware, uploadImageController);
router.post('/delete-image', requireAuth, deleteImageController);

// ── Discovery & Reads ─────────────────────────────────────────────────────
router.get('/discover', requireAuth, getAllProfilesController);
router.get('/:userId', requireAuth, getProfileController);
router.get('/:userId/interactions', requireAuth, getProfileInteractionsController);

// ── Settings & Status ─────────────────────────────────────────────────────
router.put('/settings/online-status', requireAuth, updateOnlineStatusController);
router.post('/pause', requireAuth, pauseProfileController);

// ── Delete ────────────────────────────────────────────────────────────────
router.delete('/:userId', requireAuth, deleteProfileController);

export default router;