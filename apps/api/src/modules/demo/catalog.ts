import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MediaModel } from '../media/media.model';
import { storeImage } from '../media/media.service';

/**
 * The starter menu: used by `npm run seed` and by the demo reset.
 * Photos live in apps/api/seed-assets/menu (credits in seed-assets/CREDITS.json).
 */

const ASSETS_DIR = path.resolve(__dirname, '../../../seed-assets/menu');

export const CATEGORIES = [
  { name: 'burgers', photo: 'classic-cheeseburger' },
  { name: 'sides', photo: 'fries' },
  { name: 'drinks', photo: 'chocolate-milkshake' },
  { name: 'desserts', photo: 'brownie' },
];

export interface MenuItem {
  title: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  photo: string;
  description: string;
}

export const MENU: MenuItem[] = [
  // Burgers
  { title: 'Classic Cheeseburger', category: 'burgers', price: 11.99, stockQuantity: 80, photo: 'classic-cheeseburger',
    description: 'Two-day dry-aged beef patty, melted cheddar, crisp lettuce, tomato, pickles and our house sauce on a toasted brioche bun.' },
  { title: 'Double Smash Burger', category: 'burgers', price: 14.99, compareAtPrice: 17.99, stockQuantity: 60, photo: 'double-smash-burger',
    description: 'Two smashed patties with crispy lacy edges, double American cheese, grilled onions and ketchup-mustard.' },
  { title: 'Bacon BBQ Burger', category: 'burgers', price: 15.49, stockQuantity: 50, photo: 'bacon-bbq-burger',
    description: 'Stacked beef patties, smoky streaky bacon, aged cheddar and sticky hickory BBQ glaze.' },
  { title: 'Crispy Chicken Burger', category: 'burgers', price: 12.99, stockQuantity: 60, photo: 'crispy-chicken-burger',
    description: 'Buttermilk-brined chicken thigh fried golden, with pickles, slaw and garlic mayo.' },
  { title: 'Garden Veggie Burger', category: 'burgers', price: 12.49, stockQuantity: 40, photo: 'veggie-burger',
    description: 'Chickpea and quinoa patty, smashed avocado, rocket, tomato and chipotle mayo. Vegetarian.' },
  // Sides
  { title: 'Golden Fries', category: 'sides', price: 4.49, stockQuantity: 150, photo: 'fries',
    description: 'Hand-cut skin-on potatoes, double fried and tossed in sea salt.' },
  { title: 'Loaded Cheese Fries', category: 'sides', price: 7.49, compareAtPrice: 8.99, stockQuantity: 70, photo: 'loaded-fries',
    description: 'Our fries smothered in cheese sauce, crispy onions, jalapeños and spring onion.' },
  { title: 'Beer-Battered Onion Rings', category: 'sides', price: 5.49, stockQuantity: 80, photo: 'onion-rings',
    description: 'Thick-cut sweet onions in a crunchy beer batter, served with sweet chilli dip.' },
  { title: 'Hot Honey Wings', category: 'sides', price: 9.99, compareAtPrice: 11.99, stockQuantity: 60, photo: 'chicken-wings',
    description: 'Eight crispy wings glazed in chilli-infused honey with fresh coriander.' },
  // Drinks
  { title: 'Chocolate Milkshake', category: 'drinks', price: 5.99, stockQuantity: 80, photo: 'chocolate-milkshake',
    description: 'Thick and creamy, made with real Belgian chocolate and vanilla ice cream.' },
  { title: 'Strawberry Milkshake', category: 'drinks', price: 5.99, stockQuantity: 80, photo: 'strawberry-milkshake',
    description: 'Fresh strawberries blended with vanilla ice cream and whole milk.' },
  { title: 'Fresh Mint Lemonade', category: 'drinks', price: 3.99, compareAtPrice: 4.99, stockQuantity: 100, photo: 'lemonade',
    description: 'Squeezed to order with lemons, lime, fresh mint and a touch of cane sugar.' },
  { title: 'Iced Latte', category: 'drinks', price: 4.49, stockQuantity: 100, photo: 'iced-coffee',
    description: 'Double espresso over ice with your choice of milk.' },
  // Desserts
  { title: 'Fudge Brownie Sundae', category: 'desserts', price: 6.99, stockQuantity: 50, photo: 'brownie',
    description: 'Warm chocolate fudge brownie with two scoops of vanilla and hot chocolate sauce.' },
  { title: 'New York Cheesecake', category: 'desserts', price: 6.49, stockQuantity: 40, photo: 'cheesecake',
    description: 'Baked vanilla cheesecake on a buttery biscuit base, topped with fresh berries.' },
  { title: 'Banana Split Sundae', category: 'desserts', price: 7.49, stockQuantity: 40, photo: 'ice-cream-sundae',
    description: 'Three scoops, caramelised banana, whipped cream, chocolate drizzle and a cherry on top.' },
];

/**
 * Stored reference for a seed photo. Reuses the copy already in the database
 * (uploaded by the seed, i.e. without an uploader) so reseeding and demo
 * resets never duplicate images.
 */
export async function seedPhotoRef(name: string): Promise<string> {
  const originalname = `${name}.jpg`;
  const existing = await MediaModel.findOne({ originalName: originalname, uploadedBy: { $exists: false } }, { _id: 1 }).lean();
  if (existing) return `media:${existing._id.toString()}`;
  const buffer = await readFile(path.join(ASSETS_DIR, originalname));
  return (await storeImage({ buffer, originalname })).ref;
}
