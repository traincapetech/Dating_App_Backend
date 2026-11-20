import express from 'express';
import { uploadChatMedia } from '../controllers/mediaController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Upload chat media (image)
router.post('/chat', requireAuth, uploadChatMedia);

export default router;

