import { storage } from '../storage/index.js';
import { v4 as uuidv4 } from 'uuid';
import Match from '../models/Match.js';

/**
 * Upload media (image) for chat messages
 */
export const uploadChatMedia = async (req, res) => {
  try {
    const { image, matchId } = req.body;
    const userId = req.user.id;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required',
      });
    }

    let safeMatchSegment = 'general';
    if (matchId) {
      if (!/^[0-9a-fA-F]{24}$/.test(String(matchId))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid matchId format',
        });
      }
      const match = await Match.findById(matchId);
      if (!match || !match.users.includes(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this match',
        });
      }
      safeMatchSegment = String(matchId);
    }

    // Generate unique filename
    const fileId = uuidv4();
    const timestamp = Date.now();
    const filename = `chat-media/${safeMatchSegment}/${userId}_${timestamp}_${fileId}.jpg`;

    // Handle base64 image
    let imageData = image;
    if (image.startsWith('data:')) {
      // Remove data URL prefix
      imageData = image.split(',')[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return res.status(413).json({
        success: false,
        message: 'Image too large. Maximum size is 10MB.',
      });
    }

    // Image moderation via Azure AI Content Safety
    const {moderateImage} = await import('../services/moderationService.js');
    const moderationResult = await moderateImage(buffer);

    if (!moderationResult.isSafe) {
      return res.status(400).json({
        success: false,
        message: 'Image does not meet community guidelines',
        reason: moderationResult.categories,
      });
    }

    // Upload to storage
    const result = await storage.uploadFile(filename, buffer, 'image/jpeg');

    res.json({
      success: true,
      mediaUrl: result.url,
      mediaType: 'image',
      moderationStatus: 'approved',
    });

  } catch (error) {
    console.error('Error uploading chat media:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading media',
    });
  }
};

