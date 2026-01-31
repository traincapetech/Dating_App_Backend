import express from 'express';
import {reportProblem} from '../controllers/supportController.js';

const router = express.Router();

// Report a problem
router.post('/report-problem', reportProblem);

export default router;
