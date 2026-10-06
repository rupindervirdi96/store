import mongoose from 'mongoose';
import type { CategoryDTO } from '@store/shared';
import { AppError } from '../../utils/AppError';
import { deleteIfUnreferenced, normalizeImageRef, resolveImage } from '../media/media.service';
import { ProductModel } from '../products/product.model';
import { CategoryModel, toCategoryDTO, type CategoryDocument } from './category.model';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.schemas';

async function productCounts(activeOnly: boolean): Promise<Map<string, number>> {
  const rows = await ProductModel.aggregate<{ _id: string; n: number }>([
    ...(activeOnly ? [{ $match: { isActive: true } }] : []),
    { $group: { _id: '$category', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** Public: active categories that have at least one active product, in menu order. */
export async function listPublic(): Promise<CategoryDTO[]> {
  const [cats, counts] = await Promise.all([
    CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }),
    productCounts(true),
  ]);
  const visible = cats.filter((c) => (counts.get(c.name) ?? 0) > 0);

  // Categories without their own photo borrow the cover of one of their items.
  const needPhoto = visible.filter((c) => !c.image).map((c) => c.name);
  const fallback = new Map<string, string>();
  if (needPhoto.length) {
    const rows = await ProductModel.aggregate<{ _id: string; image: string }>([
      { $match: { isActive: true, category: { $in: needPhoto }, 'images.0': { $exists: true } } },
      { $sort: { soldCount: -1, createdAt: 1 } },
      { $group: { _id: '$category', image: { $first: { $first: '$images' } } } },
    ]);
    for (const r of rows) fallback.set(r._id, r.image);
  }

  return visible.map((c) => {
    const dto = toDTO(c, counts);
    return dto.image ? dto : { ...dto, image: resolveImage(fallback.get(c.name)) ?? null };
  });
}

/** Admin: every category, with counts of all (incl. hidden) products. */
export async function listAll(): Promise<CategoryDTO[]> {
  const [cats, counts] = await Promise.all([CategoryModel.find().sort({ sortOrder: 1, name: 1 }), productCounts(false)]);
  return cats.map((c) => toDTO(c, counts));
}

const toDTO = (c: CategoryDocument, counts: Map<string, number>): CategoryDTO =>
  toCategoryDTO(c, counts.get(c.name) ?? 0);

async function nextSortOrder(): Promise<number> {
  const last = await CategoryModel.findOne().sort({ sortOrder: -1 }).lean();
  return (last?.sortOrder ?? -1) + 1;
}

export async function create(input: CreateCategoryInput): Promise<CategoryDTO> {
  if (await CategoryModel.exists({ name: input.name })) throw AppError.conflict('A category with that name already exists');
  const doc = await CategoryModel.create({
    name: input.name,
    image: input.image ? normalizeImageRef(input.image) : null,
    isActive: input.isActive ?? true,
    sortOrder: await nextSortOrder(),
  });
  return toDTO(doc, new Map());
}

/** Makes sure a category exists for a product's category name (used when products are saved). */
export async function ensureExists(name: string): Promise<void> {
  if (await CategoryModel.exists({ name })) return;
  try {
    await CategoryModel.create({ name, sortOrder: await nextSortOrder() });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // created concurrently — fine
  }
}

export async function update(id: string, input: UpdateCategoryInput): Promise<CategoryDTO> {
  const doc = await CategoryModel.findById(id);
  if (!doc) throw AppError.notFound('Category not found');
  const oldName = doc.name;
  const oldImage = doc.image;

  if (input.name && input.name !== oldName && (await CategoryModel.exists({ name: input.name }))) {
    throw AppError.conflict('A category with that name already exists');
  }

  await mongoose.connection.transaction(async (session) => {
    if (input.name !== undefined) doc.name = input.name;
    if (input.image !== undefined) doc.image = input.image ? normalizeImageRef(input.image) : null;
    if (input.isActive !== undefined) doc.isActive = input.isActive;
    await doc.save({ session });
    // Products reference categories by name, so a rename moves them along.
    if (doc.name !== oldName) {
      await ProductModel.updateMany({ category: oldName }, { category: doc.name }, { session });
    }
  });

  if (oldImage && oldImage !== doc.image) await deleteIfUnreferenced([oldImage]);
  return toDTO(doc, await productCounts(false));
}

/** Persists a new menu order: ids listed first-to-last. */
export async function reorder(ids: string[]): Promise<CategoryDTO[]> {
  await CategoryModel.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { sortOrder: i } } })));
  return listAll();
}

export async function remove(id: string): Promise<void> {
  const doc = await CategoryModel.findById(id);
  if (!doc) throw AppError.notFound('Category not found');
  // Hidden items don't block deletion; their category is re-created if they're shown again.
  const inUse = await ProductModel.countDocuments({ category: doc.name, isActive: true });
  if (inUse > 0) {
    throw AppError.conflict(`Move or delete the ${inUse} item${inUse === 1 ? '' : 's'} in "${doc.name}" first`);
  }
  await doc.deleteOne();
  if (doc.image) await deleteIfUnreferenced([doc.image]);
}
