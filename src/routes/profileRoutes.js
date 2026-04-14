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
import {authenticate} from '../middlewares/auth.js';

const router = Router();

// ── Single unified write endpoint for ALL profile updates ─────────────────
router.patch('/', authenticate, sanitizeInput, patchProfileController);

// ── Media ─────────────────────────────────────────────────────────────────
router.post('/upload-image', authenticate, uploadMiddleware, uploadImageController);
router.post('/delete-image', authenticate, deleteImageController);

// ── Discovery & Reads ─────────────────────────────────────────────────────
router.get('/discover', authenticate, getAllProfilesController);
router.get('/:userId', authenticate, getProfileController);
router.get('/:userId/interactions', authenticate, getProfileInteractionsController);

// ── Settings & Status ─────────────────────────────────────────────────────
router.put('/settings/online-status', authenticate, updateOnlineStatusController);
router.post('/pause', authenticate, pauseProfileController);

// ── Delete ────────────────────────────────────────────────────────────────
router.delete('/:userId', authenticate, deleteProfileController);

export default router;