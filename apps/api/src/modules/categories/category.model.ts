import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { CategoryDTO } from '@store/shared';
import { resolveImage } from '../media/media.service';

/**
 * Menu sections (Burgers, Sides, …). Products reference a category by its
 * `name` (lowercase), which keeps product queries simple; renaming a
 * category cascades to its products in the service.
 */
const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 60 },
    image: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CategorySchema.index({ isActive: 1, sortOrder: 1 });

export type Category = InferSchemaType<typeof CategorySchema>;
export type CategoryDocument = HydratedDocument<Category>;

export function toCategoryDTO(c: CategoryDocument, productCount = 0): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    image: resolveImage(c.image) ?? null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount,
  };
}

export const CategoryModel = model('Category', CategorySchema);
