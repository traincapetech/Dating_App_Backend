import { storage } from '../storage/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload media (image) for chat messages
 */
export const uploadChatMedia = async (req, res) => {
  try {
    const { image, userId, matchId } = req.body;

    if (!image) {
      return res.status(400).json({ 
        success: false, 
        message: "Image data is required" 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "userId is required" 
      });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const timestamp = Date.now();
    const filename = `chat-media/${matchId || 'general'}/${userId}_${timestamp}_${fileId}.jpg`;

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
        message: "Image too large. Maximum size is 10MB." 
      });
    }

    // Upload to storage
    const result = await storage.uploadFile(filename, buffer, 'image/jpeg');

    res.json({
      success: true,
      mediaUrl: result.url,
      mediaType: 'image'
    });

  } catch (error) {
    console.error("Error uploading chat media:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error uploading media", 
      error: error.message 
    });
  }
};

