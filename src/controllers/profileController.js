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
import {deleteUser, findUserById} from '../models/userModel.js';
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

export const saveDatingPreferencesController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = datingPreferencesSchema.parse(req.body);
  const profile = await saveDatingPreferences(userId, parsed);
  res.status(200).json({profile});
});

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
  const userId = req.user?.id || req.params.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const profile = await getProfile(userId);
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
  const parsed = updateProfileSchema.parse(req.body);
  const profile = await updateProfileData(userId, parsed);
  res.status(200).json({profile});
});

export const getAllProfilesController = asyncHandler(async (req, res) => {
  const excludeUserId = req.query.excludeUserId || req.user?.id;
  const profiles = await getAllProfiles(excludeUserId);
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
      // If using multer (file upload middleware)
      imageBuffer = req.file.buffer;
      fileName = req.file.originalname;
      contentType = req.file.mimetype;
    } else if (req.body.imageUri) {
      // If image is sent as base64 data URI
      const base64Data = req.body.imageUri.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName || `image_${Date.now()}.jpg`;
      contentType = req.body.contentType || 'image/jpeg';
    }

    // Generate unique file path
    const fileExtension = fileName.split('.').pop();
    const filePath = `profiles/${userId}/images/${randomUUID()}.${fileExtension}`;

    // Upload to storage (R2 or local)
    await storage.writeFile(filePath, imageBuffer, {
      contentType,
    });

    // Get public URL
    const publicUrl = storage.getPublicUrl(filePath) || 
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/files/${filePath}`;

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

    res.status(200).json({
      success: true,
      url: publicUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({error: 'Failed to upload image', message: error.message});
  }
});

export const deleteUserController = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({error: 'User ID is required'});
  }

  // Check if user exists
  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({error: 'User not found'});
  }

  // Delete profile and associated media
  const profile = await getProfile(userId);
  if (profile?.media?.media) {
    // Delete media files from storage
    for (const mediaItem of profile.media.media) {
      if (mediaItem.url) {
        try {
          // Extract file path from URL
          // R2 URLs: https://[bucket].r2.cloudflarestorage.com/[key] or custom domain
          // Local URLs: http://localhost:3000/api/files/[path]
          let filePath = null;
          
          if (mediaItem.url.includes('/api/files/')) {
            // Local storage URL
            filePath = new URL(mediaItem.url).pathname.replace('/api/files/', '');
          } else if (mediaItem.url.includes('r2.cloudflarestorage.com') || 
                     mediaItem.url.includes(config.r2.publicBaseUrl)) {
            // R2 URL - extract key from URL
            const urlObj = new URL(mediaItem.url);
            // R2 public URLs have the key as the pathname
            filePath = urlObj.pathname.replace(/^\//, ''); // Remove leading slash
          } else {
            // Try to extract from any URL format
            const urlObj = new URL(mediaItem.url);
            filePath = urlObj.pathname.replace(/^\//, '');
            // If it contains 'profiles/', use that part
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

  // Delete profile
  await deleteProfile(userId);
  
  // Delete user
  await deleteUser(userId);

  res.status(200).json({
    success: true,
    message: 'User and profile deleted successfully',
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
            filePath = new URL(mediaItem.url).pathname.replace('/api/files/', '');
          } else if (mediaItem.url.includes('r2.cloudflarestorage.com') || 
                     mediaItem.url.includes(config.r2.publicBaseUrl)) {
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

