/**
 * profileController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIFIED controller. All profile writes go through patchProfileController.
 * Legacy per-section controllers removed completely.
 */
import {asyncHandler} from '../utils/asyncHandler.js';
import {patchProfileSchema} from '../validators/profileValidators.js';
import {
  getProfile,
  updateProfileData,
  getAllProfiles,
} from '../services/profileService.js';
import {deleteProfile} from '../models/profileModel.js';
import Profile from '../models/Profile.js';
import {deleteUser, findUserById, updateUser} from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import {storage} from '../storage/index.js';
import {randomUUID} from 'crypto';
import {config} from '../config/env.js';
import Like from '../models/Like.js';
import ProfileComment from '../models/ProfileComment.js';
import multer from 'multer';

// Multer instance with memory storage
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 20 * 1024 * 1024},
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
}).single('image');

// ── SINGLE entry point for ALL profile writes (onboarding + editing) ──────
export const patchProfileController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // Strip userId from body before validation
  const {userId: _removed, ...body} = req.body;

  const parsed = patchProfileSchema.parse(body);
  const profile = await updateProfileData(userId, parsed);

  res.status(200).json({profile});
});

export const getProfileController = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const targetUserId = req.params.userId || viewerId;

  if (!targetUserId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  if (viewerId && viewerId !== targetUserId) {
    try {
      await Profile.findOneAndUpdate(
        {userId: targetUserId},
        {$inc: {views: 1}},
      );
    } catch (err) {
      console.error('[getProfileController] Failed to increment views:', err);
    }
  }

  const profile = await getProfile(targetUserId, viewerId);
  if (!profile) {
    return res.status(404).json({error: 'Profile not found'});
  }

  if (profile.isPaused && viewerId !== targetUserId) {
    return res.status(404).json({
      error: 'Profile is paused',
      message: 'This profile is currently paused and non-visible.',
    });
  }

  res.status(200).json({profile});
});

export const getAllProfilesController = asyncHandler(async (req, res) => {
  const excludeUserId = req.query.excludeUserId || req.user?.id;

  const useMatching =
    req.query.useMatching === 'true' || req.query.useMatching === '1';
  const minScore = req.query.minScore ? parseInt(req.query.minScore, 10) : 0;
  const maxDistance = req.query.maxDistance
    ? parseFloat(req.query.maxDistance)
    : null;
  const sortBy = req.query.sortBy || 'score';
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

  const filters = {};
  if (req.query.educationLevel) filters.educationLevel = req.query.educationLevel;
  if (req.query.minHeight) filters.minHeight = parseFloat(req.query.minHeight);
  if (req.query.maxHeight) filters.maxHeight = parseFloat(req.query.maxHeight);
  if (req.query.drink) filters.drink = req.query.drink;
  if (req.query.smokeTobacco) filters.smokeTobacco = req.query.smokeTobacco;
  if (req.query.smokeWeed) filters.smokeWeed = req.query.smokeWeed;
  if (req.query.religiousBeliefs) filters.religiousBeliefs = req.query.religiousBeliefs;
  if (req.query.politicalBeliefs) filters.politicalBeliefs = req.query.politicalBeliefs;

  const options = {
    useMatching,
    minScore,
    maxDistance,
    sortBy,
    limit,
    filters: Object.keys(filters).length > 0 ? filters : null,
  };

  const profiles = await getAllProfiles(excludeUserId, options);
  res.status(200).json({profiles});
});

export const uploadImageController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  if (!req.file && !req.body.imageUri) {
    return res.status(400).json({error: 'No image provided'});
  }

  try {
    let imageBuffer;
    let fileName;
    let contentType;

    if (req.file) {
      imageBuffer = req.file.buffer;
      fileName = req.file.originalname || `photo_${Date.now()}.jpg`;
      contentType = req.file.mimetype || 'image/jpeg';
    } else if (req.body.imageUri) {
      const base64Data = req.body.imageUri.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName || `image_${Date.now()}.jpg`;
      contentType = req.body.contentType || 'image/jpeg';
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({error: 'Image buffer is empty or invalid'});
    }

    const fileExtension = fileName.split('.').pop().split('?')[0] || 'jpg';
    const filePath = `profiles/${userId}/images/${randomUUID()}.${fileExtension}`;

    await storage.writeFile(filePath, imageBuffer, {contentType});

    const publicUrl =
      storage.getPublicUrl(filePath) ||
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/files/${filePath}`;

    res.status(200).json({
      success: true,
      url: publicUrl,
      message: 'Image uploaded successfully',
      filePath,
    });
  } catch (error) {
    console.error('[Image Upload] Error:', error.message);
    res.status(500).json({error: error.message || 'Image upload failed'});
  }
});

export const deleteImageController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const {imageUrl} = req.body;

  if (!userId || !imageUrl) {
    return res.status(400).json({error: 'User ID and Image URL are required'});
  }

  try {
    let filePath = null;

    if (imageUrl.includes('/api/files/')) {
      filePath = new URL(imageUrl).pathname.replace('/api/files/', '');
    } else if (
      imageUrl.includes('r2.cloudflarestorage.com') ||
      (config.r2?.publicBaseUrl && imageUrl.includes(config.r2.publicBaseUrl))
    ) {
      const urlObj = new URL(imageUrl);
      filePath = urlObj.pathname.replace(/^\//, '');
    } else {
      const urlObj = new URL(imageUrl);
      filePath = urlObj.pathname.replace(/^\//, '');
      const profilesIndex = filePath.indexOf('profiles/');
      if (profilesIndex !== -1) filePath = filePath.substring(profilesIndex);
    }

    if (filePath) {
      await storage.deleteObject(filePath);
      return res.status(200).json({success: true, message: 'Image deleted from storage'});
    } else {
      return res.status(400).json({error: 'Could not determine file path from URL'});
    }
  } catch (error) {
    console.error('[Delete Image] Error:', error);
    res.status(500).json({error: 'Failed to delete image from storage'});
  }
});

export const pauseProfileController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const {isPaused} = req.body;
  const paused = isPaused === true || isPaused === 'true';
  const profile = await updateProfileData(userId, {isPaused: paused});

  res.status(200).json({
    success: true,
    message: paused ? 'Profile paused successfully' : 'Profile resumed successfully',
    profile,
  });
});

export const updateOnlineStatusController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const {showOnlineStatus} = req.body;
  if (typeof showOnlineStatus !== 'boolean') {
    return res.status(400).json({error: 'showOnlineStatus must be a boolean'});
  }

  const user = await updateUser(userId, {showOnlineStatus});
  if (!user) {
    return res.status(404).json({error: 'User not found'});
  }

  res.status(200).json({
    success: true,
    message: 'Online status preference updated successfully',
    showOnlineStatus: user.showOnlineStatus,
  });
});

export const deleteUserController = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  const {password} = req.body;

  if (!userId) {
    return res.status(400).json({error: 'User ID is required'});
  }

  if (req.user.id !== userId) {
    return res.status(403).json({error: 'You are not authorized to delete this account'});
  }

  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({error: 'User not found'});
  }

  if (user.authProvider !== 'google') {
    if (!password) {
      return res.status(400).json({error: 'Password is required to delete your account'});
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({error: 'Incorrect password'});
    }
  }

  const profile = await getProfile(userId);
  if (profile?.media?.media) {
    for (const mediaItem of profile.media.media) {
      if (mediaItem.url) {
        try {
          let filePath = null;
          if (mediaItem.url.includes('/api/files/')) {
            filePath = new URL(mediaItem.url).pathname.replace('/api/files/', '');
          } else {
            const urlObj = new URL(mediaItem.url);
            filePath = urlObj.pathname.replace(/^\//, '');
            const profilesIndex = filePath.indexOf('profiles/');
            if (profilesIndex !== -1) filePath = filePath.substring(profilesIndex);
          }
          if (filePath) await storage.deleteObject(filePath);
        } catch (error) {
          console.error(`Failed to delete media file: ${mediaItem.url}`, error);
        }
      }
    }
  }

  const {performThoroughAccountDeletion} = await import('../services/accountDeletionService.js');
  await performThoroughAccountDeletion(userId);

  res.status(200).json({
    success: true,
    message: 'All account data has been deleted successfully as per industry standards.',
  });
});

export const deleteProfileController = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({error: 'User ID is required'});
  }

  const profile = await getProfile(userId);
  if (!profile) {
    return res.status(404).json({error: 'Profile not found'});
  }

  if (profile.media?.media) {
    for (const mediaItem of profile.media.media) {
      if (mediaItem.url) {
        try {
          let filePath = null;
          if (mediaItem.url.includes('/api/files/')) {
            filePath = new URL(mediaItem.url).pathname.replace('/api/files/', '');
          } else {
            const urlObj = new URL(mediaItem.url);
            filePath = urlObj.pathname.replace(/^\//, '');
            const profilesIndex = filePath.indexOf('profiles/');
            if (profilesIndex !== -1) filePath = filePath.substring(profilesIndex);
          }
          if (filePath) await storage.deleteObject(filePath);
        } catch (error) {
          console.error(`Failed to delete media file: ${mediaItem.url}`, error);
        }
      }
    }
  }

  await deleteProfile(userId);
  res.status(200).json({success: true, message: 'Profile deleted successfully'});
});

export const getProfileInteractionsController = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const targetUserId = req.params.userId;

  if (!targetUserId) {
    return res.status(400).json({error: 'Target User ID is required'});
  }

  if (viewerId !== targetUserId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view interactions for your own profile.',
    });
  }

  try {
    const allLikes = await Like.find({receiverId: targetUserId}).lean();

    const photoLikes = allLikes.filter(l => l.likedContent?.photoUrl);
    const profileLikes = allLikes.filter(l => !l.likedContent?.photoUrl);

    const commentsList = await ProfileComment.find({receiverId: targetUserId})
      .sort({createdAt: -1})
      .limit(50)
      .lean();

    const senderIds = [
      ...photoLikes.map(l => l.senderId),
      ...profileLikes.map(l => l.senderId),
      ...commentsList.map(c => c.senderId),
    ];
    const uniqueSenderIds = [...new Set(senderIds)];

    let populatedSenders = {};
    if (uniqueSenderIds.length > 0) {
      const senderProfiles = await Profile.find(
        {userId: {$in: uniqueSenderIds}, isPaused: {$ne: true}, isHidden: {$ne: true}},
        {'basicInfo.firstName': 1, 'basicInfo.name': 1, name: 1, photos: 1, media: 1, userId: 1},
      ).lean();

      senderProfiles.forEach(p => {
        populatedSenders[p.userId] = {
          userId: p.userId,
          name: p.basicInfo?.firstName || p.basicInfo?.name || p.name || 'User',
          avatar: p.photos?.[0] || p.media?.media?.[0]?.url || null,
        };
      });
    }

    const enriched = list =>
      list
        .filter(l => populatedSenders[l.senderId])
        .map(l => ({...l, sender: populatedSenders[l.senderId]}));

    res.status(200).json({
      success: true,
      interactions: {
        totalLikes: enriched(photoLikes).length + enriched(profileLikes).length,
        photoLikes: enriched(photoLikes),
        profileLikes: enriched(profileLikes),
        comments: enriched(commentsList),
      },
    });
  } catch (error) {
    console.error('[getProfileInteractionsController] Error:', error);
    res.status(500).json({error: 'Failed to fetch profile interactions'});
  }
});
