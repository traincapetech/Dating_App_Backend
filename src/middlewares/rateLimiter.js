import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Configuration
 * Protects API from abuse, brute force attacks, and DoS attempts
 */

// General API rate limiter - 2000 requests per 15 minutes (10000 in dev)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 2000, // 10000 per 15 mins (2000 in prod)
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// Auth rate limiter - looser for testing (100 attempts per 15 minutes in dev)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 20, // Limit each IP to 20 auth attempts per window (100 in dev)
  message: {
    success: false,
    message:
      'Too many authentication attempts, please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// OTP rate limiter - (20 attempts per 10 minutes in dev)
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'development' ? 20 : 5, // Limit each IP to 5 OTP requests per window (20 in dev)
  message: {
    success: false,
    message: 'Too many OTP requests, please try again in 10 minutes.',
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter - (10 attempts per hour in dev)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 10 : 3, // Limit each IP to 3 password reset attempts per hour (10 in dev)
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again in an hour.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Like/swipe limiter - (5000 swipes per hour in dev)
export const swipeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000, // 1000 per hr (5000 in dev)
  message: {
    success: false,
    message:
      'Swipe limit reached, please try again later or upgrade to premium.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message limiter - (500 messages per minute in dev)
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 500 : 100, // 100 messages per minute (500 in dev)
  message: {
    success: false,
    message: 'Message rate limit reached, please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Media upload limiter - (50 uploads per 10 minutes in dev)
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 20, // 20 uploads per 10 minutes (50 in dev)
  message: {
    success: false,
    message: 'Upload limit reached, please try again later.',
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  generalLimiter,
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
  swipeLimiter,
  messageLimiter,
  uploadLimiter,
};
