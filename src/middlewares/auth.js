import jwt from 'jsonwebtoken';
import {config} from '../config/env.js';
import {findUserById} from '../models/userModel.js';

/**
 * Middleware to verify user JWT token
 * Extracts user ID from token and attaches to req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header or token header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : req.headers.token || req.headers['x-access-token'];

    if (!token) {
      // If no token, allow request but req.user will be undefined
      // Controllers can handle this by checking req.user or falling back to req.body.userId
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Extract user ID from token payload (sub field contains user ID)
    const userId = decoded.sub || decoded.userId || decoded.id;
    
    if (!userId) {
      // Invalid token format, but don't block the request
      return next();
    }

    // Optionally verify user exists (can be skipped for performance)
    // const user = await findUserById(userId);
    // if (!user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'User not found',
    //   });
    // }

    // Attach user info to request
    req.user = {
      id: userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      // Invalid token, but allow request to continue
      // Controllers will handle missing req.user
      return next();
    }
    if (error.name === 'TokenExpiredError') {
      // Token expired, but allow request to continue
      return next();
    }
    // Other errors, allow request to continue
    return next();
  }
};

/**
 * Middleware that requires authentication (stricter version)
 * Returns 401 if no valid token is provided
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : req.headers.token || req.headers['x-access-token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.sub || decoded.userId || decoded.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    req.user = {
      id: userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

