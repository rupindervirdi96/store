import 'dotenv/config';
import { z } from 'zod';

// Treats unset and blank (`KEY=`) the same way.
const optionalString = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Render injects PORT; default for local dev.
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Optional: Google reviews on the home page (Places API (New)).
  GOOGLE_PLACES_API_KEY: optionalString,
  GOOGLE_PLACE_ID: optionalString,
  // Public base URL of this API, used to build image links. Render sets
  // RENDER_EXTERNAL_URL automatically; locally it falls back to localhost.
  PUBLIC_URL: optionalString,
  RENDER_EXTERNAL_URL: optionalString,
  // Stripe. Checkout is unavailable (503) until STRIPE_SECRET_KEY is set.
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  // Test-only: point the SDK at stripe-mock, e.g. http://localhost:12111
  STRIPE_API_BASE: optionalString,
  // Storefront URL Stripe returns customers to. Defaults to the first non-local CORS origin.
  WEB_URL: optionalString,
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PUBLIC_URL: (
    parsed.data.PUBLIC_URL ??
    parsed.data.RENDER_EXTERNAL_URL ??
    `http://localhost:${parsed.data.PORT}`
  ).replace(/\/+$/, ''),
  WEB_URL: (
    parsed.data.WEB_URL ??
    parsed.data.CORS_ORIGINS.find((o) => !o.includes('localhost')) ??
    parsed.data.CORS_ORIGINS[0] ??
    'http://localhost:3000'
  ).replace(/\/+$/, ''),
};
export const isProd = env.NODE_ENV === 'production';
