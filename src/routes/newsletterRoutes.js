import express from "express";
import { subscribe, getSubscribers, sendNewsletter } from "../controllers/newsletterController.js";
import { verifyAdminToken } from "../middlewares/adminAuth.js";
import { authLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

/**
 * Public routes
 */
// Apply rate limiter to subscriptions (10 attempts per 15 min)
router.post("/subscribe", authLimiter, subscribe);

/**
 * Admin protected routes
 */
router.use(verifyAdminToken);

// Get list of all subscribers
router.get("/", getSubscribers);

// Send a broadcast newsletter
router.post("/send", sendNewsletter);

export default router;
