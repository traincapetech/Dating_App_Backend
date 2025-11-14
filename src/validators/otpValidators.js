import {z} from 'zod';

export const sendEmailOTPSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email address'),
});

export const verifyEmailOTPSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Invalid email address'),
  code: z
    .string({
      required_error: 'OTP code is required',
    })
    .length(6, 'OTP code must be 6 digits')
    .regex(/^\d+$/, 'OTP code must contain only numbers'),
});

