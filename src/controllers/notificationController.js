import {asyncHandler} from '../utils/asyncHandler.js';
import {
  registerTokenSchema,
  unregisterTokenSchema,
} from '../validators/notificationValidators.js';
import {
  registerToken,
  unregisterToken,
} from '../models/notificationTokenModel.js';
import {updateUser, findUserById} from '../models/userModel.js';

export const registerTokenController = asyncHandler(async (req, res) => {
  const parsed = registerTokenSchema.parse(req.body);
  const token = await registerToken(
    parsed.userId,
    parsed.token,
    parsed.platform || 'unknown',
  );
  res.status(200).json({
    success: true,
    message: 'Notification token registered successfully',
    token,
  });
});

export const unregisterTokenController = asyncHandler(async (req, res) => {
  const parsed = unregisterTokenSchema.parse(req.body);
  await unregisterToken(parsed.userId);
  res.status(200).json({
    success: true,
    message: 'Notification token unregistered successfully',
  });
});

// Get notification preferences for a user
export const getNotificationPreferencesController = asyncHandler(async (req, res) => {
  const {userId} = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  const user = await findUserById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Default preferences if not set
  const defaultPreferences = {
    pushEnabled: true,
    newMatches: true,
    newMessages: true,
    newLikes: true,
    profileViews: false,
    superLikes: true,
  };

  const preferences = user.notificationPreferences || defaultPreferences;

  res.status(200).json({
    success: true,
    preferences,
  });
});

// Update notification preferences for a user
export const updateNotificationPreferencesController = asyncHandler(async (req, res) => {
  const {userId} = req.params;
  const {preferences} = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required',
    });
  }

  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Preferences object is required',
    });
  }

  // Validate preferences structure
  const validKeys = [
    'pushEnabled',
    'newMatches',
    'newMessages',
    'newLikes',
    'profileViews',
    'superLikes',
  ];

  const validatedPreferences = {};
  for (const key of validKeys) {
    if (preferences.hasOwnProperty(key)) {
      validatedPreferences[key] = Boolean(preferences[key]);
    }
  }

  const user = await findUserById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Update user with notification preferences
  const updatedUser = await updateUser(userId, {
    notificationPreferences: validatedPreferences,
  });

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    preferences: updatedUser.notificationPreferences || validatedPreferences,
  });
});
