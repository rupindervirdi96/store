import { DEFAULT_STORE_HOURS, WEEKDAYS, type DemoInfoDTO } from '@store/shared';
import { env } from '../../config/env';
import { hashPassword } from '../auth/auth.service';
import { CategoryModel } from '../categories/category.model';
import { MediaModel } from '../media/media.model';
import { deleteIfUnreferenced } from '../media/media.service';
import { OrderModel } from '../orders/order.model';
import { ProductModel } from '../products/product.model';
import { StoreSettingsModel } from '../store/store.model';
import { UserModel } from '../users/user.model';
import { CATEGORIES, MENU, seedPhotoRef } from './catalog';

/**
 * Demo mode (DEMO_MODE=true) turns an API instance into a public showcase:
 * published demo logins, Stripe test-card hints, and a one-click reset.
 * Only ever enable it on an instance with its own database.
 */

const DEMO_ACCOUNTS = [
  { role: 'customer', name: 'Demo Customer', email: 'customer@demo.example.com', password: 'demo1234' },
  { role: 'admin', name: 'Demo Admin', email: 'admin@demo.example.com', password: 'demo1234' },
] as const;

export const demoEnabled = () => env.DEMO_MODE;

export function demoInfo(): DemoInfoDTO {
  return {
    enabled: true,
    accounts: DEMO_ACCOUNTS.map(({ role, email, password }) => ({ role, email, password })),
    testCards: [
      { label: 'Successful payment', number: '4242 4242 4242 4242' },
      { label: 'Declined card', number: '4000 0000 0000 0002' },
    ],
    cardHint: 'Any future expiry date, any 3-digit CVC and any postal code.',
  };
}

/** Creates the demo logins, or restores their role and password if someone changed them. */
async function ensureDemoAccounts(): Promise<void> {
  for (const a of DEMO_ACCOUNTS) {
    const passwordHash = await hashPassword(a.password);
    await UserModel.updateOne(
      { email: a.email },
      { $set: { name: a.name, role: a.role, passwordHash }, $setOnInsert: { email: a.email } },
      { upsert: true },
    );
  }
}

/** Puts the starter menu and categories back exactly as shipped. */
async function restoreCatalog(): Promise<void> {
  const titles = MENU.map((m) => m.title);
  await ProductModel.deleteMany({ title: { $nin: titles } });
  for (const { photo, ...item } of MENU) {
    await ProductModel.updateOne(
      { title: item.title },
      {
        $set: {
          ...item,
          compareAtPrice: item.compareAtPrice ?? null,
          soldCount: 0,
          isActive: true,
          images: [await seedPhotoRef(photo)],
        },
      },
      { upsert: true },
    );
  }
  await CategoryModel.deleteMany({});
  await CategoryModel.insertMany(
    await Promise.all(CATEGORIES.map(async (c, i) => ({ name: c.name, image: await seedPhotoRef(c.photo), sortOrder: i }))),
  );
}

/**
 * Open all day, every day, with no closures or pause, so visitors can place
 * a test order whenever they try the demo.
 */
async function restoreStoreHours(): Promise<void> {
  const allDay = { closed: false, open: '00:00', close: '23:59' };
  await StoreSettingsModel.updateOne(
    { key: 'main' },
    {
      $set: {
        timezone: DEFAULT_STORE_HOURS.timezone,
        weekly: Object.fromEntries(WEEKDAYS.map((d) => [d, allDay])),
        closures: [],
        paused: false,
        pausedUntil: null,
      },
    },
    { upsert: true },
  );
}

/** On startup: make a fresh demo database usable without running the seed script. */
export async function prepareDemo(): Promise<void> {
  if (!demoEnabled()) return;
  await ensureDemoAccounts();
  if ((await ProductModel.estimatedDocumentCount()) === 0) await restoreCatalog();
  if (!(await StoreSettingsModel.exists({ key: 'main' }))) await restoreStoreHours();
  console.log('[demo] demo mode is ON — demo accounts are published at /api/v1/demo');
}

/**
 * Restores a clean demo: removes all orders and sign-ups, restores the menu,
 * categories, opening hours and demo logins, and deletes uploaded photos
 * nothing uses.
 */
export async function resetDemo(): Promise<{ ordersRemoved: number; usersRemoved: number; photosRemoved: number }> {
  const [orders, users] = await Promise.all([
    OrderModel.deleteMany({}),
    UserModel.deleteMany({ email: { $nin: DEMO_ACCOUNTS.map((a) => a.email) } }),
  ]);
  await ensureDemoAccounts();
  await restoreCatalog();
  await restoreStoreHours();

  const media = await MediaModel.find({}, { _id: 1 }).lean();
  const photosRemoved = await deleteIfUnreferenced(media.map((m) => `media:${m._id.toString()}`));

  console.log(`[demo] reset: ${orders.deletedCount} orders, ${users.deletedCount} users, ${photosRemoved} photos removed`);
  return { ordersRemoved: orders.deletedCount, usersRemoved: users.deletedCount, photosRemoved };
}
