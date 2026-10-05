import { z } from 'zod';

export const AddressInput = z.object({
  label: z.string().trim().max(50).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
});

export const UpdateMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  addresses: z.array(AddressInput).max(10).optional(),
});

export const PushTokenSchema = z.object({ token: z.string().min(10).max(255) });
