import {Router} from 'express';
import {
  createBoostController,
  getBoostStatusController,
  getBoostHistoryController,
} from '../controllers/boostController.js';
import {authenticate} from '../middlewares/auth.js';

const router = Router();

// All boost routes require authentication
router.use(authenticate);

// Create boost
router.post('/create', createBoostController);

// Get boost status
router.get('/status/:userId?', getBoostStatusController);

// Get boost history
router.get('/history/:userId?', getBoostHistoryController);

export default router;

