import {Router} from 'express';
import {
  saveBasicInfoController,
  saveDatingPreferencesController,
  savePersonalDetailsController,
  saveLifestyleController,
  saveProfilePromptsController,
  saveMediaController,
  getProfileController,
  updateProfileController,
  getAllProfilesController,
  uploadImageController,
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

// Apply sanitization to all profile update routes
// Apply sanitization to all profile update routes
router.post(
  '/basic-info',
  authenticate,
  sanitizeInput,
  saveBasicInfoController,
);
router.post(
  '/dating-preferences',
  authenticate,
  sanitizeInput,
  saveDatingPreferencesController,
);
router.post(
  '/personal-details',
  authenticate,
  sanitizeInput,
  savePersonalDetailsController,
);
router.post('/lifestyle', authenticate, sanitizeInput, saveLifestyleController);
router.post(
  '/profile-prompts',
  authenticate,
  sanitizeInput,
  saveProfilePromptsController,
);
router.post('/media', authenticate, saveMediaController);
router.post('/upload-image', authenticate, uploadImageController);
router.post('/delete-image', authenticate, deleteImageController);
router.get('/discover', authenticate, getAllProfilesController);
router.get('/:userId', authenticate, getProfileController);
router.get('/:userId/interactions', authenticate, getProfileInteractionsController);
router.put('/update', authenticate, sanitizeInput, updateProfileController);
router.put(
  '/settings/online-status',
  authenticate,
  updateOnlineStatusController,
);
router.post('/pause', authenticate, pauseProfileController);
router.delete('/:userId', authenticate, deleteProfileController);

export default router;