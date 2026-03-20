import {asyncHandler} from '../utils/asyncHandler.js';
import {
  sendEmailOTPSchema,
  verifyEmailOTPSchema,
} from '../validators/otpValidators.js';
import {sendEmailOTP, verifyEmailOTP} from '../services/emailService.js';

export const sendEmailOTPController = asyncHandler(async (req, res) => {
  const parsed = sendEmailOTPSchema.parse(req.body);
  const result = await sendEmailOTP(parsed.email);
  res.status(200).json(result);
});

export const verifyEmailOTPController = asyncHandler(async (req, res) => {
  const parsed = verifyEmailOTPSchema.parse(req.body);
  const result = await verifyEmailOTP(parsed.email, parsed.code);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.message,
    });
  }

  // Update user verification status
  try {
    const {updateUser, findUserByEmail} = await import(
      '../models/userModel.js'
    );
    const user = await findUserByEmail(parsed.email);
    if (user) {
      await updateUser(user.id, {isVerified: true});
    }
  } catch (userUpdateError) {
    console.error(
      'Failed to update user verification status:',
      userUpdateError,
    );
    // Continue anyway as OTP itself was valid
  }

  res.status(200).json({
    success: true,
    message: result.message,
  });
});
