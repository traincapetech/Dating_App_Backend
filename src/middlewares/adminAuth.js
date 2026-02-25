import jwt from 'jsonwebtoken';
import {findAdminById, hasPermission} from '../models/Admin.js';

/**
 * Middleware to verify admin JWT token
 */
export const verifyAdminToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-admin-token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Admin token required',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-me');

    // Verify admin exists and is active
    const admin = await findAdminById(decoded.adminId);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive admin account',
      });
    }

    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Admin token expired',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error verifying admin token',
    });
  }
};

/**
 * Middleware to check if admin has specific permission
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    if (!req.adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required',
      });
    }

    const hasAccess = await hasPermission(req.adminId, permission);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: permission,
      });
    }

    next();
  };
};

/**
 * Middleware to check if admin has any of the specified permissions
 */
export const requireAnyPermission = (...permissions) => {
  return async (req, res, next) => {
    if (!req.adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required',
      });
    }

    for (const permission of permissions) {
      const hasAccess = await hasPermission(req.adminId, permission);
      if (hasAccess) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      required: permissions,
    });
  };
};

