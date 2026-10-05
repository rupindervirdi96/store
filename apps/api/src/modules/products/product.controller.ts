import type { Request, Response } from 'express';
import { IdParams, parse } from '../../middleware/validate';
import {
  CreateProductSchema,
  ListProductsQuery,
  StockAdjustSchema,
  UpdateProductSchema,
} from './product.schemas';
import * as productService from './product.service';

const isAdmin = (req: Request) => req.user?.role === 'admin';

export async function list(req: Request, res: Response) {
  const query = parse(ListProductsQuery, req.query);
  res.json(await productService.list(query, { allowInactive: isAdmin(req) }));
}

export async function categories(_req: Request, res: Response) {
  res.json(await productService.categories());
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await productService.getById(id, { allowInactive: isAdmin(req) }));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await productService.create(parse(CreateProductSchema, req.body)));
}

export async function update(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await productService.update(id, parse(UpdateProductSchema, req.body)));
}

export async function adjustStock(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await productService.adjustStock(id, parse(StockAdjustSchema, req.body)));
}

export async function archive(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  await productService.archive(id);
  res.status(204).end();
}
