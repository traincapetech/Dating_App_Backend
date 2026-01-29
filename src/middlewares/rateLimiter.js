import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Configuration
 * Protects API from abuse, brute force attacks, and DoS attempts
 */

// General API rate limiter - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});

// Auth rate limiter - stricter for login/signup (10 attempts per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// OTP rate limiter - very strict (5 attempts per 10 minutes)
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 OTP requests per window
  message: {
    success: false,
    message: 'Too many OTP requests, please try again in 10 minutes.',
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter - strict (3 attempts per hour)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again in an hour.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Like/swipe limiter - prevent spam swiping (100 swipes per hour for free users)
export const swipeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 swipes per hour
  message: {
    success: false,
    message: 'Swipe limit reached, please try again later or upgrade to premium.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message limiter - prevent spam messaging (50 messages per minute)
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 messages per minute
  message: {
    success: false,
    message: 'Message rate limit reached, please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Media upload limiter - prevent abuse (10 uploads per 10 minutes)
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 uploads per 10 minutes
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
