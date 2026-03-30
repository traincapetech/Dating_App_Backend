import express from 'express';
import { subscribe, unsubscribe, getSubscribers, sendNewsletter } from '../controllers/newsletterController.js';
import { verifyAdminToken, requirePermission } from '../middlewares/adminAuth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

/**
 * Public routes
 */
// Apply rate limiter to subscriptions (10 attempts per 15 min)
router.post('/subscribe', authLimiter, subscribe);
router.post('/unsubscribe', unsubscribe);

/**
 * Admin protected routes
 */
router.use(verifyAdminToken);

// Get list of all subscribers (Admin Only)
router.get('/', getSubscribers);

// Send a broadcast newsletter (Admin Only)
router.post('/send', sendNewsletter);

export default router;
