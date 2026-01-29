import {Router} from 'express';
import {
  sendEmailOTPController,
  verifyEmailOTPController,
} from '../controllers/otpController.js';
import {otpLimiter} from '../middlewares/rateLimiter.js';

const router = Router();

// Apply strict rate limiter to OTP (5 requests per 10 min)
router.post('/email/send', otpLimiter, sendEmailOTPController);
router.post('/email/verify', otpLimiter, verifyEmailOTPController);

export default router;

