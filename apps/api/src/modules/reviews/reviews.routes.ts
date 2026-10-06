import { Router } from 'express';
import { getReviews } from './reviews.service';

export const reviewsRouter = Router();

reviewsRouter.get('/', async (_req, res) => {
  // Let browsers/CDNs reuse the response briefly; the service caches for longer.
  res.set('Cache-Control', 'public, max-age=300');
  res.json(await getReviews());
});
