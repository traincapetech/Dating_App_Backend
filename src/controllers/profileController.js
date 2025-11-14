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
} from '../services/profileService.js';

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

