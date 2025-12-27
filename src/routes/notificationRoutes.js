import {Router} from 'express';
import {
  registerTokenController,
  unregisterTokenController,
  getNotificationPreferencesController,
  updateNotificationPreferencesController,
} from '../controllers/notificationController.js';

const router = Router();

router.post('/register', registerTokenController);
router.post('/unregister', unregisterTokenController);
router.get('/preferences/:userId', getNotificationPreferencesController);
router.put('/preferences/:userId', updateNotificationPreferencesController);

export default router;


