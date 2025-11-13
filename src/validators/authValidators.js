import {z} from 'zod';

export const signUpSchema = z.object({
  fullName: z
    .string({
      required_error: 'Full name is required',
    })
    .min(2)
    .max(80),
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email(),
  phone: z
    .string({
      required_error: 'Phone number is required',
    })
    .min(5)
    .max(20),
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(6)
    .max(64),
});

export const signInSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email(),
  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(6),
});

