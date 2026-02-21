import jwt from 'jsonwebtoken';
import {config} from '../config/env.js';
import {findUserById} from '../models/userModel.js';

/**
 * Middleware to verify user JWT token
 * Extracts user ID from token and attaches to req.user
 * SECURITY: Returns 401 for invalid/expired tokens
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header or token header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : req.headers.token || req.headers['x-access-token'];

    console.log(
      `[Auth Middleware] ${req.method} ${
        req.path
      } - Token present: ${!!token}, Auth header: ${
        authHeader ? 'Bearer ...' + authHeader.slice(-10) : 'NONE'
      }, token header: ${
        req.headers.token ? '...' + req.headers.token.slice(-10) : 'NONE'
      }`,
    );

    if (!token) {
      // No token provided - allow request but req.user will be undefined
      // Protected routes should use requireAuth instead
      console.log('[Auth Middleware] No token found, proceeding without user');
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Extract user ID from token payload (sub field contains user ID)
    const userId = decoded.sub || decoded.userId || decoded.id;

    console.log(
      `[Auth Middleware] Token decoded successfully. userId: ${userId}, email: ${decoded.email}`,
    );

    if (!userId) {
      // Invalid token format - reject
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
      });
    }

    // Attach user info to request
    req.user = {
      id: userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    console.error(
      `[Auth Middleware] Error: ${error.name} - ${error.message} for ${req.method} ${req.path}`,
    );
    if (error.name === 'JsonWebTokenError') {
      // Invalid token - reject
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      // Token expired - reject
      console.error('[Auth Middleware] Token expired at:', error.expiredAt);
      return res.status(401).json({
        success: false,
        message: 'Authentication token expired',
      });
    }
    // Other errors
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
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
