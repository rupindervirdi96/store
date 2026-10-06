import { Router, type Request, type Response } from 'express';
import { optionalAuth, requireAdmin } from '../../middleware/auth';
import { IdParams, parse } from '../../middleware/validate';
import { CreateCategorySchema, ReorderSchema, UpdateCategorySchema } from './category.schemas';
import * as categoryService from './category.service';

async function list(req: Request, res: Response) {
  const all = req.user?.role === 'admin' && req.query.includeInactive === 'true';
  res.json(all ? await categoryService.listAll() : await categoryService.listPublic());
}

async function create(req: Request, res: Response) {
  res.status(201).json(await categoryService.create(parse(CreateCategorySchema, req.body)));
}

async function update(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await categoryService.update(id, parse(UpdateCategorySchema, req.body)));
}

async function reorder(req: Request, res: Response) {
  res.json(await categoryService.reorder(parse(ReorderSchema, req.body).ids));
}

async function remove(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  await categoryService.remove(id);
  res.status(204).end();
}

export const categoryRouter = Router();

categoryRouter.get('/', optionalAuth, list);
categoryRouter.post('/', ...requireAdmin, create);
categoryRouter.put('/order', ...requireAdmin, reorder);
categoryRouter.patch('/:id', ...requireAdmin, update);
categoryRouter.delete('/:id', ...requireAdmin, remove);
