import {Router} from 'express';
import {
  signIn,
  signUp,
  googleSignIn,
  updateEmail,
  updatePassword,
  forgotPassword,
  resetPasswordController,
  logoutFromAllDevicesController,
} from '../controllers/authController.js';
import {deleteUserController} from '../controllers/profileController.js';
import {authenticate} from '../middlewares/auth.js';
import {authLimiter, passwordResetLimiter} from '../middlewares/rateLimiter.js';

const router = Router();

// Apply auth rate limiter to login/signup (10 attempts per 15 min)
router.post('/signup', authLimiter, signUp);
router.post('/login', authLimiter, signIn);
router.post('/google', authLimiter, googleSignIn);
router.post('/change-email', authenticate, updateEmail);
router.post('/change-password', authenticate, updatePassword);

// Apply stricter rate limiter to password reset (3 attempts per hour)
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPasswordController);

router.post(
  '/logout-all-devices',
  authenticate,
  logoutFromAllDevicesController,
);
router.delete('/user/:userId', authenticate, deleteUserController);

export default router;
