import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env, isProd } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { stripeWebhook } from './modules/payments/payments.routes';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Render terminates TLS at its proxy; trust it so req.ip and rate limiting
  // see the real client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      // Native mobile apps send no Origin header, so requests without one are allowed.
      origin(origin, cb) {
        // Disallowed origins get no CORS headers, so the browser blocks the response.
        cb(null, !origin || env.CORS_ORIGINS.includes(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  );
  // Stripe webhooks need the untouched body to verify the signature, so this
  // route is registered before the JSON parser.
  app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);
  app.use(express.json({ limit: '100kb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Render health check (configured in render.yaml).
  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp, uptime: process.uptime() });
  });

  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
