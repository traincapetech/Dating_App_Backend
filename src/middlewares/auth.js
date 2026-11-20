import jwt from 'jsonwebtoken';
import {config} from '../config/env.js';
import {findUserById, updateUser} from '../models/userModel.js';

export const updateActivityStatus = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      updateUser(req.user.id, {lastActive: new Date()}).catch(err => {
        console.error('[Auth Middleware] Failed to update lastActive:', err.message);
      });
    } catch (e) {
      // Ignore errors so we don't block requests
    }
  }
  next();
};

const extractToken = req => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers.token || req.headers['x-access-token'] || null;
};

const verifyAndAttachUser = async (token, req, res) => {
  const decoded = jwt.verify(token, config.jwtSecret);

  // Reject refresh tokens used as access tokens
  if (decoded.type === 'refresh') {
    res.status(401).json({
      success: false,
      message: 'Invalid token type',
    });
    return false;
  }

  const userId = decoded.sub || decoded.userId || decoded.id;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Invalid token format',
    });
    return false;
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(401).json({
      success: false,
      message: 'User no longer exists or account was deleted.',
    });
    return false;
  }

  // Strictly enforce tokenVersion match whenever user has a tokenVersion
  if (
    user.tokenVersion !== undefined &&
    user.tokenVersion !== null &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    res.status(401).json({
      success: false,
      message: 'Session has been invalidated. Please log in again.',
    });
    return false;
  }

  req.user = {
    id: String(userId),
    email: decoded.email || user.email,
    role: user.role || 'user',
  };
  return true;
};

const handleAuthError = (error, res) => {
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    });
  }
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token expired',
    });
  }
  return res.status(500).json({
    success: false,
    message: 'Authentication error',
  });
};

/**
 * Optional auth middleware — only for genuinely public endpoints that optionally
 * personalize output when a valid token is present.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }
    const ok = await verifyAndAttachUser(token, req, res);
    if (!ok) return;
    return updateActivityStatus(req, res, next);
  } catch (error) {
    return handleAuthError(error, res);
  }
};

/**
 * Strict authentication middleware — returns 401 if no valid access token is provided.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    const ok = await verifyAndAttachUser(token, req, res);
    if (!ok) return;
    return updateActivityStatus(req, res, next);
  } catch (error) {
    return handleAuthError(error, res);
  }
};
