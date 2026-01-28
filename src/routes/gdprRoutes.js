import {Router} from 'express';
import {
  exportDataController,
  requestDataDeletionController,
  cancelDeletionController,
  immediateDeletionController,
} from '../controllers/gdprController.js';
import {authenticate} from '../middlewares/auth.js';

const router = Router();

/**
 * GDPR Compliance Routes
 * Implements GDPR rights: Access, Portability, Erasure, Rectification
 */

// Export user data (GDPR Right to Data Portability)
router.get('/export', authenticate, exportDataController);
router.get('/export/:userId', authenticate, exportDataController);

// Request data deletion (GDPR Right to Erasure) - with grace period
router.post('/delete-request', authenticate, requestDataDeletionController);

// Cancel scheduled deletion
router.post('/cancel-deletion', authenticate, cancelDeletionController);

// Immediate deletion (admin only or after grace period)
router.delete('/delete-immediate/:userId', authenticate, immediateDeletionController);

export default router;

