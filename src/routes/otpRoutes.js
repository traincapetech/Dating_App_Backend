import {Router} from 'express';
import {
  sendEmailOTPController,
  verifyEmailOTPController,
} from '../controllers/otpController.js';

const router = Router();

router.post('/email/send', sendEmailOTPController);
router.post('/email/verify', verifyEmailOTPController);

export default router;

