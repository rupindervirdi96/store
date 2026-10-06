import { z } from 'zod';

const price = z
  .number()
  .nonnegative()
  .max(1_000_000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
    message: 'Price can have at most 2 decimal places',
  });

// Absolute URL, or a site-relative path to an asset bundled with the web app.
const imageRef = z.union([
  z.url({ protocol: /^https?$/ }),
  z.string().regex(/^\/(?!\/)[\w\-./]+$/, 'Must be an http(s) URL or a /path'),
]);

// No defaults here: in Zod 4, defaults still apply inside .partial(), which
// would make every PATCH reset omitted fields (e.g. stock back to 0).
const productFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  price,
  /** "Was" price for special offers; null means not on offer. */
  compareAtPrice: price.nullable(),
  category: z.string().trim().min(1).max(60).toLowerCase(),
  stockQuantity: z.number().int().nonnegative(),
  images: z.array(imageRef).max(10),
  isActive: z.boolean(),
});

export const CreateProductSchema = productFields
  .extend({
    description: productFields.shape.description.default(''),
    compareAtPrice: productFields.shape.compareAtPrice.default(null),
    stockQuantity: productFields.shape.stockQuantity.default(0),
    images: productFields.shape.images.default([]),
    isActive: productFields.shape.isActive.default(true),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: 'Original price must be higher than the sale price',
    path: ['compareAtPrice'],
  });

export const UpdateProductSchema = productFields.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update',
});

export const StockAdjustSchema = z.union([
  z.object({ set: z.number().int().nonnegative() }),
  z.object({ delta: z.number().int() }),
]);

export const ListProductsQuery = z.object({
  category: z.string().trim().toLowerCase().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  onSale: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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
