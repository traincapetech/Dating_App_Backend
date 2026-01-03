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

const router = Router();

router.post('/basic-info', saveBasicInfoController);
router.post('/dating-preferences', saveDatingPreferencesController);
router.post('/personal-details', savePersonalDetailsController);
router.post('/lifestyle', saveLifestyleController);
router.post('/profile-prompts', saveProfilePromptsController);
router.post('/media', saveMediaController);
router.post('/upload-image', uploadImageController);
router.get('/discover', getAllProfilesController);
router.get('/:userId', getProfileController);
router.put('/update', updateProfileController);
router.post('/pause', pauseProfileController);
router.delete('/:userId', deleteProfileController);

export default router;

