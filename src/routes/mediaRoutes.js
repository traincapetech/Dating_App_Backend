import express from 'express';
import { uploadChatMedia } from '../controllers/mediaController.js';

const router = express.Router();

// Upload chat media (image)
router.post('/chat', uploadChatMedia);

export default router;

