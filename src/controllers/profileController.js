import {asyncHandler} from '../utils/asyncHandler.js';
import {
  basicInfoSchema,
  datingPreferencesSchema,
  personalDetailsSchema,
  lifestyleSchema,
  profilePromptsSchema,
  mediaUploadSchema,
  updateProfileSchema,
} from '../validators/profileValidators.js';
import {
  saveBasicInfo,
  saveDatingPreferences,
  savePersonalDetails,
  saveLifestyle,
  saveProfilePrompts,
  saveMedia,
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

export const saveBasicInfoController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = basicInfoSchema.parse(req.body);
  const profile = await saveBasicInfo(userId, parsed);
  res.status(200).json({profile});
});

export const saveDatingPreferencesController = asyncHandler(
  async (req, res) => {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({error: 'User ID is required'});
    }
    const parsed = datingPreferencesSchema.parse(req.body);
    const profile = await saveDatingPreferences(userId, parsed);
    res.status(200).json({profile});
  },
);

export const savePersonalDetailsController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = personalDetailsSchema.parse(req.body);
  const profile = await savePersonalDetails(userId, parsed);
  res.status(200).json({profile});
});

export const saveLifestyleController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = lifestyleSchema.parse(req.body);
  const profile = await saveLifestyle(userId, parsed);
  res.status(200).json({profile});
});

export const saveProfilePromptsController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = profilePromptsSchema.parse(req.body);
  const profile = await saveProfilePrompts(userId, parsed);
  res.status(200).json({profile});
});

export const saveMediaController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = mediaUploadSchema.parse(req.body);
  const profile = await saveMedia(userId, parsed);
  res.status(200).json({profile});
});

export const getProfileController = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const targetUserId = req.params.userId || viewerId;

  if (!targetUserId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // If viewing someone else's profile, increment views
  if (viewerId && viewerId !== targetUserId) {
    try {
      await Profile.findOneAndUpdate(
        {userId: targetUserId},
        {$inc: {views: 1}},
      );
    } catch (err) {
      console.error('[getProfileController] Failed to increment views:', err);
      // Continue even if view increment fails
    }
  }

  const profile = await getProfile(targetUserId);
  if (!profile) {
    return res.status(404).json({error: 'Profile not found'});
  }
  res.status(200).json({profile});
});

export const updateProfileController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  // Remove userId from body before validation (it's not part of the schema)
  const {userId: _, ...bodyWithoutUserId} = req.body;

  console.log(
    '[updateProfileController] Received body:',
    JSON.stringify(bodyWithoutUserId, null, 2),
  );

  const parsed = updateProfileSchema.parse(bodyWithoutUserId);

  console.log(
    '[updateProfileController] Parsed data:',
    JSON.stringify(parsed, null, 2),
  );

  const profile = await updateProfileData(userId, parsed);

  console.log(
    '[updateProfileController] Saved profile basicInfo:',
    JSON.stringify(profile?.basicInfo, null, 2),
  );
  console.log(
    '[updateProfileController] Saved profile lifestyle:',
    JSON.stringify(profile?.lifestyle, null, 2),
  );

  res.status(200).json({profile});
});

export const pauseProfileController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const {isPaused} = req.body;
  const paused = isPaused === true || isPaused === 'true' || isPaused === true;
  const profile = await updateProfileData(userId, {isPaused: paused});

  res.status(200).json({
    success: true,
    message: paused
      ? 'Profile paused successfully'
      : 'Profile resumed successfully',
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

export const getAllProfilesController = asyncHandler(async (req, res) => {
  const excludeUserId = req.query.excludeUserId || req.user?.id;

  // Parse matching options from query parameters
  const useMatching =
    req.query.useMatching === 'true' || req.query.useMatching === '1';
  const minScore = req.query.minScore ? parseInt(req.query.minScore, 10) : 0;
  const maxDistance = req.query.maxDistance
    ? parseFloat(req.query.maxDistance)
    : null;
  const sortBy = req.query.sortBy || 'score'; // 'score', 'distance', 'recent'
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

  // Advanced filters (premium feature)
  const filters = {};
  if (req.query.educationLevel) {
    filters.educationLevel = req.query.educationLevel;
  }
  if (req.query.minHeight) {
    filters.minHeight = parseFloat(req.query.minHeight);
  }
  if (req.query.maxHeight) {
    filters.maxHeight = parseFloat(req.query.maxHeight);
  }
  if (req.query.drink) {
    filters.drink = req.query.drink;
  }
  if (req.query.smokeTobacco) {
    filters.smokeTobacco = req.query.smokeTobacco;
  }
  if (req.query.smokeWeed) {
    filters.smokeWeed = req.query.smokeWeed;
  }
  if (req.query.religiousBeliefs) {
    filters.religiousBeliefs = req.query.religiousBeliefs;
  }
  if (req.query.politicalBeliefs) {
    filters.politicalBeliefs = req.query.politicalBeliefs;
  }

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
    // Log storage configuration
    console.log('[Image Upload] Storage driver:', config.storageDriver);
    console.log('[Image Upload] R2 configured:', {
      accountId: config.r2.accountId ? 'Set' : 'NOT SET',
      accessKeyId: config.r2.accessKeyId ? 'Set' : 'NOT SET',
      secretAccessKey: config.r2.secretAccessKey ? 'Set' : 'NOT SET',
      bucket: config.r2.bucket || 'NOT SET',
      prefix: config.r2.prefix || '(none)',
      publicBaseUrl: config.r2.publicBaseUrl || 'NOT SET',
    });

    let imageBuffer;
    let fileName;
    let contentType;

    if (req.file) {
      // If using multer (file upload middleware)
      imageBuffer = req.file.buffer;
      fileName = req.file.originalname;
      contentType = req.file.mimetype;
    } else if (req.body.imageUri) {
      // If image is sent as base64 data URI
      const base64Data = req.body.imageUri.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName || `image_${Date.now()}.jpg`;
      contentType = req.body.contentType || 'image/jpeg';
    }

    console.log('[Image Upload] Image details:', {
      fileName,
      contentType,
      bufferSize: imageBuffer?.length || 0,
      userId,
    });

    // Generate unique file path
    const fileExtension = fileName.split('.').pop();
    const filePath = `profiles/${userId}/images/${randomUUID()}.${fileExtension}`;

    console.log('[Image Upload] Uploading to path:', filePath);
    console.log(
      '[Image Upload] Storage driver being used:',
      config.storageDriver,
    );

    // Upload to storage (R2 or local)
    await storage.writeFile(filePath, imageBuffer, {
      contentType,
    });

    console.log('[Image Upload] File uploaded successfully to:', filePath);

    // Get public URL
    const publicUrl =
      storage.getPublicUrl(filePath) ||
      `${
        process.env.API_BASE_URL || 'http://localhost:3000'
      }/api/files/${filePath}`;

    console.log('[Image Upload] Public URL:', publicUrl);

    // Update profile with new media
    const existing = await getProfile(userId);
    const existingMedia = existing?.media?.media || [];
    const newMediaItem = {
      type: 'photo',
      url: publicUrl,
      order: existingMedia.length,
    };

    await saveMedia(userId, {
      media: [...existingMedia, newMediaItem],
    });

    console.log('[Image Upload] Profile updated with new media item');

    res.status(200).json({
      success: true,
      url: publicUrl,
      message: 'Image uploaded successfully',
      storageDriver: config.storageDriver,
      filePath,
    });
  } catch (error) {
    console.error('[Image Upload] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    res.status(500).json({
      error: 'Failed to upload image',
      message: error.message,
      storageDriver: config.storageDriver,
    });
  }
});

export const deleteUserController = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  const {password} = req.body;

  if (!userId) {
    return res.status(400).json({error: 'User ID is required'});
  }

  // SECURITY: Ensure user is only deleting THEIR OWN account
  if (req.user.id !== userId) {
    return res
      .status(403)
      .json({error: 'You are not authorized to delete this account'});
  }

  // Check if user exists
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({error: 'User not found'});
  }

  // SECURITY: Verify password for local accounts
  if (user.authProvider !== 'google') {
    if (!password) {
      return res
        .status(400)
        .json({error: 'Password is required to delete your account'});
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({error: 'Incorrect password'});
    }
  }

  // Perform industry-standard thorough deletion (photos, matches, messages, scores, etc.)
  const {performThoroughAccountDeletion} = await import(
    '../services/accountDeletionService.js'
  );
  await performThoroughAccountDeletion(userId);

  res.status(200).json({
    success: true,
    message:
      'All account data has been deleted successfully as per industry standards.',
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

  // Delete media files from storage
  if (profile.media?.media) {
    for (const mediaItem of profile.media.media) {
      if (mediaItem.url) {
        try {
          // Extract file path from URL (same logic as deleteUserController)
          let filePath = null;

          if (mediaItem.url.includes('/api/files/')) {
            filePath = new URL(mediaItem.url).pathname.replace(
              '/api/files/',
              '',
            );
          } else if (
            mediaItem.url.includes('r2.cloudflarestorage.com') ||
            mediaItem.url.includes(config.r2.publicBaseUrl)
          ) {
            const urlObj = new URL(mediaItem.url);
            filePath = urlObj.pathname.replace(/^\//, '');
          } else {
            const urlObj = new URL(mediaItem.url);
            filePath = urlObj.pathname.replace(/^\//, '');
            const profilesIndex = filePath.indexOf('profiles/');
            if (profilesIndex !== -1) {
              filePath = filePath.substring(profilesIndex);
            }
          }

          if (filePath) {
            await storage.deleteObject(filePath);
            console.log(`Deleted media file: ${filePath}`);
          }
        } catch (error) {
          console.error(`Failed to delete media file: ${mediaItem.url}`, error);
        }
      }
    }
  }

  await deleteProfile(userId);
  res.status(200).json({
    success: true,
    message: 'Profile deleted successfully',
  });
});
