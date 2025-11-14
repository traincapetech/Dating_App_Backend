import {Router} from 'express';
import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import otpRoutes from './otpRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/otp', otpRoutes);

export default router;
