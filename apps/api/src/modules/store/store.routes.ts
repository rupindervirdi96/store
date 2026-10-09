import { Router, type Request, type Response } from 'express';
import { requireAdmin } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { PauseSchema, UpdateHoursSchema } from './store.schemas';
import * as storeService from './store.service';

async function info(_req: Request, res: Response) {
  // Status changes minute to minute; let clients poll without stale caches.
  res.set('Cache-Control', 'no-store').json(await storeService.getInfo());
}

async function updateHours(req: Request, res: Response) {
  res.json(await storeService.updateHours(parse(UpdateHoursSchema, req.body)));
}

async function pause(req: Request, res: Response) {
  res.json(await storeService.pause(parse(PauseSchema, req.body).duration));
}

async function resume(_req: Request, res: Response) {
  res.json(await storeService.resume());
}

export const storeRouter = Router();

storeRouter.get('/', info);
storeRouter.put('/hours', ...requireAdmin, updateHours);
storeRouter.post('/pause', ...requireAdmin, pause);
storeRouter.delete('/pause', ...requireAdmin, resume);
