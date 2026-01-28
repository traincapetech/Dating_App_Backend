import {asyncHandler} from '../utils/asyncHandler.js';
import {
  exportUserData,
  scheduleDataDeletion,
  cancelScheduledDeletion,
} from '../services/gdprService.js';
import {deleteUserController} from './profileController.js';

/**
 * GDPR Controller - Handles GDPR compliance requests
 * Implements: Right to Access, Right to Data Portability, Right to Erasure
 */

/**
 * Export user data (GDPR Right to Data Portability)
 * GET /api/gdpr/export
 */
export const exportDataController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.params.userId || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // Verify user can only export their own data (unless admin)
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({error: 'Unauthorized to export this user\'s data'});
  }

  const dataExport = await exportUserData(userId);

  // Set headers for JSON download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pryvo-data-export-${userId}-${Date.now()}.json"`);

  res.status(200).json(dataExport);
});

/**
 * Request data deletion (GDPR Right to Erasure)
 * POST /api/gdpr/delete-request
 */
export const requestDataDeletionController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // Verify user can only delete their own data (unless admin)
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({error: 'Unauthorized to delete this user\'s data'});
  }

  const gracePeriodDays = req.body.gracePeriodDays || 30; // Default 30 days grace period
  const result = await scheduleDataDeletion(userId, gracePeriodDays);

  res.status(200).json({
    success: true,
    message: 'Data deletion request received. Your account will be permanently deleted after the grace period.',
    ...result,
  });
});

/**
 * Cancel scheduled deletion
 * POST /api/gdpr/cancel-deletion
 */
export const cancelDeletionController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // Verify user can only cancel their own deletion (unless admin)
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({error: 'Unauthorized to cancel this deletion'});
  }

  const result = await cancelScheduledDeletion(userId);

  res.status(200).json(result);
});

/**
 * Immediate data deletion (admin only or after grace period)
 * DELETE /api/gdpr/delete-immediate
 */
export const immediateDeletionController = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({error: 'User ID is required'});
  }

  // Only allow immediate deletion if:
  // 1. User is deleting their own account AND grace period has passed
  // 2. Admin is deleting any account
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({error: 'User not found'});
  }

  const isOwnAccount = req.user?.id === userId;
  const isAdmin = req.user?.role === 'admin';
  const gracePeriodPassed = user.deletionDate && new Date(user.deletionDate) <= new Date();

  if (!isAdmin && (!isOwnAccount || !gracePeriodPassed)) {
    return res.status(403).json({
      error: 'Immediate deletion not allowed. Please use scheduled deletion or wait for grace period.',
    });
  }

  // Use existing deleteUserController logic
  await deleteUserController(req, res);
});

// Import required function
import {findUserById} from '../models/userModel.js';

