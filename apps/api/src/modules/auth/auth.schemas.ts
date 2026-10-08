import { OTP_LENGTH } from '@store/shared';
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'), // bcrypt input limit
});

export const VerifyEmailSchema = z.object({
  email: z.email().toLowerCase(),
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code from the email`),
});

export const ResendCodeSchema = z.object({ email: z.email().toLowerCase() });

export const LoginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
