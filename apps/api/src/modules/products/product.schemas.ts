import { z } from 'zod';

const price = z
  .number()
  .nonnegative()
  .max(1_000_000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
    message: 'Price can have at most 2 decimal places',
  });

export const CreateProductSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(''),
  price,
  category: z.string().trim().min(1).max(60).toLowerCase(),
  stockQuantity: z.number().int().nonnegative().default(0),
  images: z.array(z.url()).max(10).default([]),
  isActive: z.boolean().default(true),
});

export const UpdateProductSchema = CreateProductSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update',
});

export const StockAdjustSchema = z.union([
  z.object({ set: z.number().int().nonnegative() }),
  z.object({ delta: z.number().int() }),
]);

export const ListProductsQuery = z.object({
  category: z.string().trim().toLowerCase().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type StockAdjustInput = z.infer<typeof StockAdjustSchema>;
export type ListProductsInput = z.infer<typeof ListProductsQuery>;
