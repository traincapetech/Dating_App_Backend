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
} from '../controllers/profileController.js';
import {sanitizeInput} from '../middlewares/sanitizer.js';
import {authenticate} from '../middlewares/auth.js';

const router = Router();

// Apply sanitization to all profile update routes
router.post('/basic-info', sanitizeInput, saveBasicInfoController);
router.post('/dating-preferences', sanitizeInput, saveDatingPreferencesController);
router.post('/personal-details', sanitizeInput, savePersonalDetailsController);
router.post('/lifestyle', sanitizeInput, saveLifestyleController);
router.post('/profile-prompts', sanitizeInput, saveProfilePromptsController);
router.post('/media', saveMediaController);
router.post('/upload-image', uploadImageController);
router.get('/discover', getAllProfilesController);
router.get('/:userId', getProfileController);
router.put('/update', sanitizeInput, updateProfileController);
router.post('/pause', pauseProfileController);
router.delete('/:userId', authenticate, deleteProfileController);

export default router;

