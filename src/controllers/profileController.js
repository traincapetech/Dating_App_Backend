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
import Like from '../models/Like.js';
import ProfileComment from '../models/ProfileComment.js';
import multer from 'multer';

// Multer instance with memory storage (files land in req.file.buffer)
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 20 * 1024 * 1024}, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
}).single('image');

// Helper to keep User.onboardingStep in sync with Profile state
const syncOnboardingStep = async (userId, profile) => {
  try {
    const {deriveOnboardingStepFromProfile} = await import('../utils/onboardingUtils.js');
    const newStep = deriveOnboardingStepFromProfile(profile);
    await updateUser(userId, {onboardingStep: newStep});
    console.log(`[Onboarding Sync] Updated step to ${newStep} for ${userId}`);
    return newStep;
  } catch (err) {
    console.warn('[Onboarding Sync] Failed to update step:', err.message);
    return null;
  }
};

export const saveBasicInfoController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = basicInfoSchema.parse(req.body);
  const profile = await saveBasicInfo(userId, parsed);
  await syncOnboardingStep(userId, profile);
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
    await syncOnboardingStep(userId, profile);
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
  await syncOnboardingStep(userId, profile);
  res.status(200).json({profile});
});

export const saveLifestyleController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = lifestyleSchema.parse(req.body);
  const profile = await saveLifestyle(userId, parsed);
  await syncOnboardingStep(userId, profile);
  res.status(200).json({profile});
});

export const saveProfilePromptsController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = profilePromptsSchema.parse(req.body);
  const profile = await saveProfilePrompts(userId, parsed);
  await syncOnboardingStep(userId, profile);
  res.status(200).json({profile});
});

export const saveMediaController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }
  const parsed = mediaUploadSchema.parse(req.body);
  const profile = await saveMedia(userId, parsed);
  await syncOnboardingStep(userId, profile);
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

  const profile = await getProfile(targetUserId, viewerId);
  if (!profile) {
    return res.status(404).json({error: 'Profile not found'});
  }

  // ENFORCE "Pause Profile" visibility rules
  if (profile.isPaused && viewerId !== targetUserId) {
    return res.status(404).json({
      error: 'Profile is paused',
      message: 'This profile is currently paused and non-visible.',
    });
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
  await syncOnboardingStep(userId, profile);

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
    let imageBuffer;
    let fileName;
    let contentType;

    if (req.file) {
      // ✅ Multipart upload via multer (preferred - from FormData)
      imageBuffer = req.file.buffer;
      fileName = req.file.originalname || `photo_${Date.now()}.jpg`;
      contentType = req.file.mimetype || 'image/jpeg';
      console.log('[Image Upload] Received multipart file:', {fileName, contentType, size: imageBuffer.length});
    } else if (req.body.imageUri) {
      // Legacy: base64 data URI in JSON body
      const base64Data = req.body.imageUri.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      fileName = req.body.fileName || `image_${Date.now()}.jpg`;
      contentType = req.body.contentType || 'image/jpeg';
      console.log('[Image Upload] Received base64 body:', {fileName, contentType, size: imageBuffer.length});
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(400).json({error: 'Image buffer is empty or invalid'});
    }

    // Generate unique file path
    const fileExtension = fileName.split('.').pop().split('?')[0] || 'jpg';
    const filePath = `profiles/${userId}/images/${randomUUID()}.${fileExtension}`;

    console.log('[Image Upload] Uploading to path:', filePath);

    await storage.writeFile(filePath, imageBuffer, {contentType});

    const publicUrl =
      storage.getPublicUrl(filePath) ||
      `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/files/${filePath}`;

    console.log('[Image Upload] Success. Public URL:', publicUrl);

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
            filePath = new URL(mediaItem.url).pathname.replace(
              '/api/files/',
              '',
            );
          } else if (
            mediaItem.url.includes('r2.cloudflarestorage.com') ||
            mediaItem.url.includes(config.r2.publicBaseUrl)
          ) {
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

export const getProfileInteractionsController = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const targetUserId = req.params.userId;

  if (!targetUserId) {
    return res.status(400).json({error: 'Target User ID is required'});
  }

  // Security check: Only the owner of the profile can view their interactions
  if (viewerId !== targetUserId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only view interactions for your own profile.',
    });
  }

  try {
    // Note: We only get interactions where the current user is the "receiver"
    // Fetch total likes
    const allLikes = await Like.find({ receiverId: targetUserId }).lean();
    const totalLikes = allLikes.length;
    
    // FETCH ALL LIKES and STRICTLY SEPARATE THEM
    // Rule: photoLikes ONLY contain likes with a specific photoUrl. profileLikes contain the rest.
    const photoLikes = allLikes.filter(l => l.likedContent?.photoUrl);
    const profileLikes = allLikes.filter(l => !l.likedContent?.photoUrl);

    // Fetch received comments (icebreakers/profile comments)
    // We populate basic sender info if possible, but at least return the comments
    const commentsList = await ProfileComment.find({ receiverId: targetUserId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(50) // Reasonable limit to prevent massive payloads
      .lean();

    // If we wanted to get sender names/photos, we'd need to manually lookup or populate, 
    // but returning the comments directly works for now if we just want to display the text.
    // To keep it simple, we will return the senderId so the frontend could theoretically link them,
    // or we can aggregate. Let's send them as-is to start.
    
    // We will extract unique sender IDs to populate their basic profile info
    const senderIds = [
      ...photoLikes.map(l => l.senderId),
      ...profileLikes.map(l => l.senderId),
      ...commentsList.map(c => c.senderId)
    ];
    const uniqueSenderIds = [...new Set(senderIds)];

    let populatedSenders = {};
    if (uniqueSenderIds.length > 0) {
      const senderProfiles = await Profile.find(
        {
          userId: {$in: uniqueSenderIds},
          isPaused: {$ne: true},
          isHidden: {$ne: true},
        },
        {
          userId: 1,
          isPaused: 1,
          isHidden: 1,
          'basicInfo.firstName': 1,
          'basicInfo.name': 1,
          name: 1,
          photos: 1,
          media: 1,
        },
      ).lean();

      senderProfiles.forEach(p => {
        populatedSenders[p.userId] = {
          userId: p.userId,
          name: p.basicInfo?.firstName || p.basicInfo?.name || p.name || 'User',
          avatar: p.photos?.[0] || p.media?.media?.[0]?.url || null,
        };
      });
    }

    // Attach sender info AND FILTER OUT PAUSED SENDERS
    const enrichedPhotoLikes = photoLikes
      .filter(l => populatedSenders[l.senderId])
      .map(l => ({
        ...l,
        sender: populatedSenders[l.senderId],
      }));

    const enrichedProfileLikes = profileLikes
      .filter(l => populatedSenders[l.senderId])
      .map(l => ({
        ...l,
        sender: populatedSenders[l.senderId],
      }));

    const enrichedComments = commentsList
      .filter(c => populatedSenders[c.senderId])
      .map(c => ({
        ...c,
        sender: populatedSenders[c.senderId],
      }));

    res.status(200).json({
      success: true,
      interactions: {
        totalLikes: enrichedPhotoLikes.length + enrichedProfileLikes.length,
        photoLikes: enrichedPhotoLikes,
        profileLikes: enrichedProfileLikes,
        comments: enrichedComments,
      },
    });
  } catch (error) {
    console.error('[getProfileInteractionsController] Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile interactions' });
  }
});

export const deleteImageController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  const { imageUrl } = req.body;

  if (!userId || !imageUrl) {
    return res.status(400).json({ error: 'User ID and Image URL are required' });
  }

  try {
    let filePath = null;

    if (imageUrl.includes('/api/files/')) {
      filePath = new URL(imageUrl).pathname.replace('/api/files/', '');
    } else if (
      imageUrl.includes('r2.cloudflarestorage.com') ||
      (config.r2.publicBaseUrl && imageUrl.includes(config.r2.publicBaseUrl))
    ) {
      const urlObj = new URL(imageUrl);
      filePath = urlObj.pathname.replace(/^\//, '');
    } else {
      // General extraction from any URL
      const urlObj = new URL(imageUrl);
      filePath = urlObj.pathname.replace(/^\//, '');
      const profilesIndex = filePath.indexOf('profiles/');
      if (profilesIndex !== -1) {
        filePath = filePath.substring(profilesIndex);
      }
    }

    if (filePath) {
      console.log(`[Delete Image] Deleting object: ${filePath}`);
      await storage.deleteObject(filePath);
      return res.status(200).json({ success: true, message: 'Image deleted from storage' });
    } else {
      return res.status(400).json({ error: 'Could not determine file path from URL' });
    }
  } catch (error) {
    console.error('[Delete Image] Error:', error);
    res.status(500).json({ error: 'Failed to delete image from storage' });
  }
});