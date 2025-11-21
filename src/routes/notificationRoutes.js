import {Router} from 'express';
import {
  registerTokenController,
  unregisterTokenController,
} from '../controllers/notificationController.js';

const router = Router();

router.post('/register', registerTokenController);
router.post('/unregister', unregisterTokenController);

export default router;


