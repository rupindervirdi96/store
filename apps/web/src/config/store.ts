import { STORE_BRAND } from '@store/shared';

/**
 * Store details shown on the home page, footer and contact sections.
 * The description and social links are still placeholders.
 */
export const store = {
  name: STORE_BRAND.name,
  tagline: STORE_BRAND.tagline,
  description:
    'Hand-pressed burgers, crispy sides and thick shakes, made to order from fresh ingredients — and tracked live from our grill to your door.',

  address: {
    line1: '1-73 rue St-Onge',
    city: 'Gatineau',
    region: 'QC',
    postalCode: 'J8Y 5V1',
  },
  phone: '(438) 998-1746',
  email: 'virdimarketingsolutions@gmail.com',

  // Opening hours are managed in Admin → Hours (GET /store).

  /** Typical prep time shown in the hero. */
  prepTime: '20 min',

  social: {
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
  },
};
// Menu categories (names, photos, order) are managed in Admin → Categories.

export const fullAddress = `${store.address.line1}, ${store.address.city}, ${store.address.region} ${store.address.postalCode}`;
export const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
export const telHref = `tel:${store.phone.replace(/[^\d+]/g, '')}`;
