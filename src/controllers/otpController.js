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

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

