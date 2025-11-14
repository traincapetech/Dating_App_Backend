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
} from '../controllers/profileController.js';

const router = Router();

router.post('/basic-info', saveBasicInfoController);
router.post('/dating-preferences', saveDatingPreferencesController);
router.post('/personal-details', savePersonalDetailsController);
router.post('/lifestyle', saveLifestyleController);
router.post('/profile-prompts', saveProfilePromptsController);
router.post('/media', saveMediaController);
router.get('/:userId', getProfileController);
router.put('/update', updateProfileController);

export default router;

