import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'), // bcrypt input limit
});

export const LoginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
