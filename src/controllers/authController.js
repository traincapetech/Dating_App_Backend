import {
  registerUser,
  authenticateUser,
  authenticateWithGoogle,
  changeEmail,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '../services/authService.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {
  signUpSchema,
  signInSchema,
  changeEmailSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';

export const signUp = asyncHandler(async (req, res) => {
  const parsed = signUpSchema.parse(req.body);
  const result = await registerUser(parsed);
  res.status(201).json(result);
});

export const signIn = asyncHandler(async (req, res) => {
  const parsed = signInSchema.parse(req.body);
  const result = await authenticateUser(parsed);
  res.status(200).json(result);
});

export const updateEmail = asyncHandler(async (req, res) => {
  const parsed = changeEmailSchema.parse(req.body);
  const result = await changeEmail(parsed);
  res.status(200).json(result);
});

export const updatePassword = asyncHandler(async (req, res) => {
  const parsed = changePasswordSchema.parse(req.body);
  const result = await changePassword(parsed);
  res.status(200).json(result);
});

export const googleSignIn = asyncHandler(async (req, res) => {
  const {idToken} = req.body;
  if (!idToken) {
    return res
      .status(400)
      .json({success: false, message: 'ID token is required'});
  }
  const result = await authenticateWithGoogle({idToken});
  res.status(200).json(result);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const parsed = requestPasswordResetSchema.parse(req.body);
  const result = await requestPasswordReset(parsed.email);
  res.status(200).json(result);
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  const parsed = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(parsed);
  res.status(200).json(result);
});

export const logoutFromAllDevicesController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const {blacklistAllUserTokens} = await import('../models/tokenBlacklist.js');
  await blacklistAllUserTokens(userId);

  res.status(200).json({
    success: true,
    message: 'Logged out from all devices successfully',
  });
});
