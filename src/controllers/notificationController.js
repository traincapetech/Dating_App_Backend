import {asyncHandler} from '../utils/asyncHandler.js';
import {
  registerTokenSchema,
  unregisterTokenSchema,
} from '../validators/notificationValidators.js';
import {
  registerToken,
  unregisterToken,
} from '../models/notificationTokenModel.js';

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


