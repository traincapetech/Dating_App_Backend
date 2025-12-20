import {registerUser, authenticateUser, changeEmail, changePassword} from '../services/authService.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {
  signUpSchema,
  signInSchema,
  changeEmailSchema,
  changePasswordSchema,
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

