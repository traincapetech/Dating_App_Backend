import {Router} from 'express';
import {
  exportDataController,
  requestDataDeletionController,
  cancelDeletionController,
  immediateDeletionController,
} from '../controllers/gdprController.js';
import {requireAuth} from '../middlewares/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GDPR Compliance Routes
 * Implements GDPR rights: Access, Portability, Erasure, Rectification
 */

// Export user data (GDPR Right to Data Portability)
router.get('/export', exportDataController);
router.get('/export/:userId', exportDataController);

// Request data deletion (GDPR Right to Erasure) - with grace period
router.post('/delete-request', requestDataDeletionController);

// Cancel scheduled deletion
router.post('/cancel-deletion', cancelDeletionController);

// Immediate deletion (admin only or after grace period)
router.delete('/delete-immediate/:userId', immediateDeletionController);

export default router;

