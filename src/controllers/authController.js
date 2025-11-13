import {registerUser, authenticateUser} from '../services/authService.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {
  signUpSchema,
  signInSchema,
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

