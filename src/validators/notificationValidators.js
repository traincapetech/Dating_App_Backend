import {z} from 'zod';

export const registerTokenSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  token: z.string().min(1, 'Device token is required'),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

export const unregisterTokenSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});


