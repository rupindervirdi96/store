/**
 * Builds indexes, creates (or promotes) the admin account and inserts sample
 * products when the catalog is empty. Safe to run repeatedly.
 *
 *   npm run seed
 */
import { connectDatabase, disconnectDatabase } from '../config/db';
import { hashPassword } from '../modules/auth/auth.service';
import { OrderModel } from '../modules/orders/order.model';
import { ProductModel } from '../modules/products/product.model';
import { UserModel } from '../modules/users/user.model';

const SAMPLE_PRODUCTS = [
  { title: 'Cold Brew Coffee', description: 'Smooth, 18-hour steeped cold brew.', price: 4.5, category: 'drinks', stockQuantity: 120 },
  { title: 'Matcha Latte', description: 'Ceremonial-grade matcha with oat milk.', price: 5.25, category: 'drinks', stockQuantity: 80 },
  { title: 'Butter Croissant', description: 'Flaky, all-butter, baked this morning.', price: 3.75, category: 'bakery', stockQuantity: 60 },
  { title: 'Sourdough Loaf', description: 'Naturally leavened country loaf.', price: 8.0, category: 'bakery', stockQuantity: 25 },
  { title: 'Avocado Toast', description: 'Smashed avocado, chili flakes, lime.', price: 9.5, category: 'breakfast', stockQuantity: 40 },
  { title: 'Granola Bowl', description: 'House granola, yogurt, seasonal fruit.', price: 7.25, category: 'breakfast', stockQuantity: 35 },
];

async function main() {
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

  if ((await ProductModel.estimatedDocumentCount()) === 0) {
    await ProductModel.insertMany(SAMPLE_PRODUCTS);
    console.log(`[seed] inserted ${SAMPLE_PRODUCTS.length} sample products`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
