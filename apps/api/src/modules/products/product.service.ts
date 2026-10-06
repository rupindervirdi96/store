import type { FilterQuery, SortOrder } from 'mongoose';
import type { Paginated, ProductDTO } from '@store/shared';
import { AppError } from '../../utils/AppError';
import { broadcastStockChanged } from '../orders/order.events';
import { ProductModel, toProductDTO, type Product } from './product.model';
import type {
  CreateProductInput,
  ListProductsInput,
  StockAdjustInput,
  UpdateProductInput,
} from './product.schemas';

const SORTS: Record<ListProductsInput['sort'], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1, createdAt: -1 },
};

export async function list(
  input: ListProductsInput,
  opts: { allowInactive: boolean },
): Promise<Paginated<ProductDTO>> {
  const filter: FilterQuery<Product> = {};
  if (!(opts.allowInactive && input.includeInactive)) filter.isActive = true;
  if (input.category) filter.category = input.category;
  if (input.onSale) filter.compareAtPrice = { $ne: null };
  if (input.q) filter.$text = { $search: input.q };

  const skip = (input.page - 1) * input.limit;
  const [docs, total] = await Promise.all([
    ProductModel.find(filter).sort(SORTS[input.sort]).skip(skip).limit(input.limit),
    ProductModel.countDocuments(filter),
  ]);

  return {
    data: docs.map(toProductDTO),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
}

export async function categories(): Promise<string[]> {
  const cats = await ProductModel.distinct('category', { isActive: true });
  return cats.sort();
}

export async function getById(id: string, opts: { allowInactive: boolean }): Promise<ProductDTO> {
  const doc = await ProductModel.findById(id);
  if (!doc || (!doc.isActive && !opts.allowInactive)) throw AppError.notFound('Product not found');
  return toProductDTO(doc);
}

export async function create(input: CreateProductInput): Promise<ProductDTO> {
  return toProductDTO(await ProductModel.create(input));
}

export async function update(id: string, input: UpdateProductInput): Promise<ProductDTO> {
  const doc = await ProductModel.findById(id);
  if (!doc) throw AppError.notFound('Product not found');
  doc.set(input);
  // Re-check against the merged document: either field may have changed.
  if (doc.compareAtPrice != null && doc.compareAtPrice <= doc.price) {
    throw AppError.badRequest('Original price must be higher than the sale price');
  }
  await doc.save();
  if (input.stockQuantity !== undefined) broadcastStockChanged(doc.id, doc.stockQuantity);
  return toProductDTO(doc);
}

/** Atomic stock adjustment; a negative delta can never push stock below zero. */
export async function adjustStock(id: string, input: StockAdjustInput): Promise<ProductDTO> {
  const doc =
    'set' in input
      ? await ProductModel.findByIdAndUpdate(id, { stockQuantity: input.set }, { new: true })
      : await ProductModel.findOneAndUpdate(
          { _id: id, stockQuantity: { $gte: -input.delta } },
          { $inc: { stockQuantity: input.delta } },
          { new: true },
        );

  if (!doc) {
    const exists = await ProductModel.exists({ _id: id });
    throw exists ? AppError.conflict('Insufficient stock for this adjustment') : AppError.notFound('Product not found');
  }
  broadcastStockChanged(doc.id, doc.stockQuantity);
  return toProductDTO(doc);
}

/**
 * Soft delete: products are referenced by historical orders, so we deactivate
 * rather than remove them.
 */
export async function archive(id: string): Promise<void> {
  const res = await ProductModel.updateOne({ _id: id }, { isActive: false });
  if (res.matchedCount === 0) throw AppError.notFound('Product not found');
}
