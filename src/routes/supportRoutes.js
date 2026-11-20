import express from 'express';
import {reportProblem} from '../controllers/supportController.js';
import {requireAuth} from '../middlewares/auth.js';

const router = express.Router();

// Report a problem
router.post('/report-problem', requireAuth, reportProblem);

export default router;
