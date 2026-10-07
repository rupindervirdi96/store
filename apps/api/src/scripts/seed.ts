/**
 * Builds indexes, creates (or promotes) the admin account, sets up menu
 * categories and inserts any menu items that don't exist yet (matched by
 * title). Photos are uploaded into MongoDB like any admin upload. Safe to run
 * repeatedly.
 *
 *   npm run seed
 *   npm run seed -- --replace-menu   # also archive active products not in MENU
 *
 * Also migrates products/orders still pointing at the old web-bundled
 * "/images/menu/<name>.jpg" paths to uploaded images.
 */
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { hashPassword } from '../modules/auth/auth.service';
import { CategoryModel } from '../modules/categories/category.model';
import { CATEGORIES, MENU, seedPhotoRef } from '../modules/demo/catalog';
import { MediaModel } from '../modules/media/media.model';
import { OrderModel } from '../modules/orders/order.model';
import { ProductModel } from '../modules/products/product.model';
import { UserModel } from '../modules/users/user.model';

const LEGACY_PREFIX = '/images/menu/';

/** Each seed photo is resolved at most once per run. */
const uploaded = new Map<string, string>();
async function uploadAsset(name: string): Promise<string> {
  const cached = uploaded.get(name);
  if (cached) return cached;
  const ref = await seedPhotoRef(name);
  uploaded.set(name, ref);
  return ref;
}

/** "/images/menu/fries.jpg" → uploaded ref; anything else is left alone. */
async function migrateRef(ref: string): Promise<string> {
  if (!ref.startsWith(LEGACY_PREFIX)) return ref;
  return uploadAsset(path.basename(ref, '.jpg'));
}

async function main() {
  const replaceMenu = process.argv.includes('--replace-menu');
  await connectDatabase();

  await Promise.all([UserModel.syncIndexes(), ProductModel.syncIndexes(), OrderModel.syncIndexes()]);
  console.log('[seed] indexes synced');

  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`[seed] promoted ${email} to admin`);
    }
  } else if (password) {
    await UserModel.create({ name: 'Store Admin', email, passwordHash: await hashPassword(password), role: 'admin' });
    console.log(`[seed] created admin ${email}`);
  } else {
    console.warn('[seed] SEED_ADMIN_PASSWORD not set; skipping admin creation');
  }

  await Promise.all([CategoryModel.syncIndexes(), MediaModel.syncIndexes()]);

  // ── Menu items ──────────────────────────────────────────────
  const titles = MENU.map((m) => m.title);
  const present = new Set((await ProductModel.find({ title: { $in: titles } }, { title: 1 }).lean()).map((p) => p.title));
  const missing = MENU.filter((m) => !present.has(m.title));
  for (const { photo, ...item } of missing) {
    await ProductModel.create({ ...item, images: [await uploadAsset(photo)] });
  }
  console.log(missing.length ? `[seed] inserted ${missing.length} menu items` : '[seed] menu already present');

  if (replaceMenu) {
    // Archive (not delete): past orders still reference these products.
    const res = await ProductModel.updateMany({ title: { $nin: titles }, isActive: true }, { isActive: false });
    console.log(`[seed] archived ${res.modifiedCount} products not on the menu`);
  }

  // ── Migrate legacy web-bundled image paths to uploads ───────
  let migratedProducts = 0;
  for (const p of await ProductModel.find({ images: { $regex: `^${LEGACY_PREFIX}` } })) {
    p.images = await Promise.all(p.images.map(migrateRef));
    await p.save();
    migratedProducts++;
  }
  let migratedOrders = 0;
  for (const o of await OrderModel.find({ 'items.image': { $regex: `^${LEGACY_PREFIX}` } })) {
    for (const item of o.items) if (item.image) item.image = await migrateRef(item.image);
    await o.save();
    migratedOrders++;
  }
  if (migratedProducts || migratedOrders) {
    console.log(`[seed] moved photos into the database for ${migratedProducts} products, ${migratedOrders} orders`);
  }

  // ── Categories ──────────────────────────────────────────────
  let order = (await CategoryModel.findOne().sort({ sortOrder: -1 }).lean())?.sortOrder ?? -1;
  for (const c of CATEGORIES) {
    const existingCat = await CategoryModel.findOne({ name: c.name });
    if (!existingCat) {
      await CategoryModel.create({ name: c.name, image: await uploadAsset(c.photo), sortOrder: ++order });
      console.log(`[seed] created category "${c.name}"`);
    } else if (!existingCat.image) {
      existingCat.image = await uploadAsset(c.photo);
      await existingCat.save();
    }
  }
  // Any other category used by products gets a (photo-less) entry so admins can manage it.
  for (const name of await ProductModel.distinct('category', { isActive: true })) {
    if (!(await CategoryModel.exists({ name }))) await CategoryModel.create({ name, sortOrder: ++order });
  }

  console.log(`[seed] uploaded ${uploaded.size} photos`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
