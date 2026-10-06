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
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { hashPassword } from '../modules/auth/auth.service';
import { CategoryModel } from '../modules/categories/category.model';
import { MediaModel } from '../modules/media/media.model';
import { storeImage } from '../modules/media/media.service';
import { OrderModel } from '../modules/orders/order.model';
import { ProductModel } from '../modules/products/product.model';
import { UserModel } from '../modules/users/user.model';

// Photos in apps/api/seed-assets/menu (credits in seed-assets/CREDITS.json).
const ASSETS_DIR = path.resolve(__dirname, '../../seed-assets/menu');
const LEGACY_PREFIX = '/images/menu/';
const img = (name: string) => [`${LEGACY_PREFIX}${name}.jpg`];

const CATEGORIES = [
  { name: 'burgers', photo: 'classic-cheeseburger' },
  { name: 'sides', photo: 'fries' },
  { name: 'drinks', photo: 'chocolate-milkshake' },
  { name: 'desserts', photo: 'brownie' },
];

/** Uploads each seed photo at most once per run. */
const uploaded = new Map<string, string>();
async function uploadAsset(name: string): Promise<string> {
  const cached = uploaded.get(name);
  if (cached) return cached;
  const buffer = await readFile(path.join(ASSETS_DIR, `${name}.jpg`));
  const { ref } = await storeImage({ buffer, originalname: `${name}.jpg` });
  uploaded.set(name, ref);
  return ref;
}

/** "/images/menu/fries.jpg" → uploaded ref; anything else is left alone. */
async function migrateRef(ref: string): Promise<string> {
  if (!ref.startsWith(LEGACY_PREFIX)) return ref;
  return uploadAsset(path.basename(ref, '.jpg'));
}

const MENU = [
  // Burgers
  { title: 'Classic Cheeseburger', category: 'burgers', price: 11.99, stockQuantity: 80, images: img('classic-cheeseburger'),
    description: 'Two-day dry-aged beef patty, melted cheddar, crisp lettuce, tomato, pickles and our house sauce on a toasted brioche bun.' },
  { title: 'Double Smash Burger', category: 'burgers', price: 14.99, compareAtPrice: 17.99, stockQuantity: 60, images: img('double-smash-burger'),
    description: 'Two smashed patties with crispy lacy edges, double American cheese, grilled onions and ketchup-mustard.' },
  { title: 'Bacon BBQ Burger', category: 'burgers', price: 15.49, stockQuantity: 50, images: img('bacon-bbq-burger'),
    description: 'Stacked beef patties, smoky streaky bacon, aged cheddar and sticky hickory BBQ glaze.' },
  { title: 'Crispy Chicken Burger', category: 'burgers', price: 12.99, stockQuantity: 60, images: img('crispy-chicken-burger'),
    description: 'Buttermilk-brined chicken thigh fried golden, with pickles, slaw and garlic mayo.' },
  { title: 'Garden Veggie Burger', category: 'burgers', price: 12.49, stockQuantity: 40, images: img('veggie-burger'),
    description: 'Chickpea and quinoa patty, smashed avocado, rocket, tomato and chipotle mayo. Vegetarian.' },
  // Sides
  { title: 'Golden Fries', category: 'sides', price: 4.49, stockQuantity: 150, images: img('fries'),
    description: 'Hand-cut skin-on potatoes, double fried and tossed in sea salt.' },
  { title: 'Loaded Cheese Fries', category: 'sides', price: 7.49, compareAtPrice: 8.99, stockQuantity: 70, images: img('loaded-fries'),
    description: 'Our fries smothered in cheese sauce, crispy onions, jalapeños and spring onion.' },
  { title: 'Beer-Battered Onion Rings', category: 'sides', price: 5.49, stockQuantity: 80, images: img('onion-rings'),
    description: 'Thick-cut sweet onions in a crunchy beer batter, served with sweet chilli dip.' },
  { title: 'Hot Honey Wings', category: 'sides', price: 9.99, compareAtPrice: 11.99, stockQuantity: 60, images: img('chicken-wings'),
    description: 'Eight crispy wings glazed in chilli-infused honey with fresh coriander.' },
  // Drinks
  { title: 'Chocolate Milkshake', category: 'drinks', price: 5.99, stockQuantity: 80, images: img('chocolate-milkshake'),
    description: 'Thick and creamy, made with real Belgian chocolate and vanilla ice cream.' },
  { title: 'Strawberry Milkshake', category: 'drinks', price: 5.99, stockQuantity: 80, images: img('strawberry-milkshake'),
    description: 'Fresh strawberries blended with vanilla ice cream and whole milk.' },
  { title: 'Fresh Mint Lemonade', category: 'drinks', price: 3.99, compareAtPrice: 4.99, stockQuantity: 100, images: img('lemonade'),
    description: 'Squeezed to order with lemons, lime, fresh mint and a touch of cane sugar.' },
  { title: 'Iced Latte', category: 'drinks', price: 4.49, stockQuantity: 100, images: img('iced-coffee'),
    description: 'Double espresso over ice with your choice of milk.' },
  // Desserts
  { title: 'Fudge Brownie Sundae', category: 'desserts', price: 6.99, stockQuantity: 50, images: img('brownie'),
    description: 'Warm chocolate fudge brownie with two scoops of vanilla and hot chocolate sauce.' },
  { title: 'New York Cheesecake', category: 'desserts', price: 6.49, stockQuantity: 40, images: img('cheesecake'),
    description: 'Baked vanilla cheesecake on a buttery biscuit base, topped with fresh berries.' },
  { title: 'Banana Split Sundae', category: 'desserts', price: 7.49, stockQuantity: 40, images: img('ice-cream-sundae'),
    description: 'Three scoops, caramelised banana, whipped cream, chocolate drizzle and a cherry on top.' },
];

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
  for (const item of missing) {
    await ProductModel.create({ ...item, images: await Promise.all(item.images.map(migrateRef)) });
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
