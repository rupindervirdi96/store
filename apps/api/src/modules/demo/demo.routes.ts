import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { AppError } from '../../utils/AppError';
import { demoEnabled, demoInfo, resetDemo } from './demo.service';

// Outside demo mode these routes don't exist (404), so the storefront shows no demo UI.
function onlyInDemo(_req: Request, _res: Response, next: NextFunction) {
  next(demoEnabled() ? undefined : AppError.notFound('Not found'));
}

export const demoRouter = Router();

demoRouter.use(onlyInDemo);
demoRouter.get('/', (_req, res) => {
  res.json(demoInfo());
});
demoRouter.post('/reset', ...requireAdmin, async (_req, res) => {
  res.json(await resetDemo());
});
