import {Router} from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import otpRoutes from './otpRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import gdprRoutes from './gdprRoutes.js';
import giftRoutes from './giftRoutes.js';
import streakRoutes from '../modules/streak/streak.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/otp', otpRoutes);
router.use('/notifications', notificationRoutes);
router.use('/gdpr', gdprRoutes);
router.use('/gifts', giftRoutes);
router.use('/streak', streakRoutes);

export default router;
