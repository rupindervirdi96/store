/**
 * Builds indexes, creates (or promotes) the admin account and inserts any menu
 * items that don't exist yet (matched by title). Safe to run repeatedly.
 *
 *   npm run seed
 *   npm run seed -- --replace-menu   # also archive active products not in MENU
 */
import { connectDatabase, disconnectDatabase } from '../config/db';
import { hashPassword } from '../modules/auth/auth.service';
import { OrderModel } from '../modules/orders/order.model';
import { ProductModel } from '../modules/products/product.model';
import { UserModel } from '../modules/users/user.model';

// Images live in apps/web/public/images/menu (see CREDITS.json there).
const img = (name: string) => [`/images/menu/${name}.jpg`];

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

  const titles = MENU.map((m) => m.title);
  const present = new Set((await ProductModel.find({ title: { $in: titles } }, { title: 1 }).lean()).map((p) => p.title));
  const missing = MENU.filter((m) => !present.has(m.title));
  if (missing.length) {
    await ProductModel.insertMany(missing);
    console.log(`[seed] inserted ${missing.length} menu items`);
  } else {
    console.log('[seed] menu already present');
  }

  if (replaceMenu) {
    // Archive (not delete): past orders still reference these products.
    const res = await ProductModel.updateMany({ title: { $nin: titles }, isActive: true }, { isActive: false });
    console.log(`[seed] archived ${res.modifiedCount} products not on the menu`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
