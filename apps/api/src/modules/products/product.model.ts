import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import type { ProductDTO } from '@store/shared';

const ProductSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    // Stored in major units with 2dp precision enforced by validation.
    // Switch to integer minor units (cents) if you add multi-currency.
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, lowercase: true },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Storefront listing: active products in a category, newest first.
ProductSchema.index({ isActive: 1, category: 1, createdAt: -1 });
// Price sorting within active catalog.
ProductSchema.index({ isActive: 1, price: 1 });
// Keyword search on title/description.
ProductSchema.index({ title: 'text', description: 'text' }, { weights: { title: 5, description: 1 } });

export type Product = InferSchemaType<typeof ProductSchema>;
export type ProductDocument = HydratedDocument<Product>;

export function toProductDTO(p: ProductDocument): ProductDTO {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    stockQuantity: p.stockQuantity,
    images: p.images,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const ProductModel = model('Product', ProductSchema);
