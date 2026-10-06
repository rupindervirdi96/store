import { z } from 'zod';
import { objectId } from '../../middleware/validate';
import { imageRef } from '../products/product.schemas';

const name = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .toLowerCase()
  .regex(/^[\p{L}\p{N} &'-]+$/u, 'Use letters, numbers, spaces, & or -');

export const CreateCategorySchema = z.object({
  name,
  image: imageRef.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateCategorySchema = z
  .object({ name, image: imageRef.nullable(), isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const ReorderSchema = z.object({ ids: z.array(objectId).min(1).max(200) });

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
