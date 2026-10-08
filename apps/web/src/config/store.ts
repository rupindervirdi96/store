import { STORE_BRAND } from '@store/shared';

/**
 * Store details shown on the home page, footer and contact sections.
 * Everything here is placeholder content — replace it with your real details.
 */
export const store = {
  name: STORE_BRAND.name,
  tagline: STORE_BRAND.tagline,
  description:
    'Hand-pressed burgers, crispy sides and thick shakes, made to order from fresh ingredients — and tracked live from our grill to your door.',

  address: {
    line1: '123 Example Street',
    city: 'Springfield',
    region: 'ST',
    postalCode: '00000',
  },
  phone: '(555) 012-3456',
  email: 'hello@example.com',

  /** Displayed in order; times are local to the store. */
  hours: [
    { days: 'Monday – Thursday', time: '11:00 am – 10:00 pm' },
    { days: 'Friday – Saturday', time: '11:00 am – 11:00 pm' },
    { days: 'Sunday', time: '12:00 pm – 9:00 pm' },
  ],

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
