import type { Request, Response } from 'express';
import { IdParams, parse } from '../../middleware/validate';
import { CreateOrderSchema, ListOrdersQuery, UpdatePaymentSchema, UpdateStatusSchema } from './order.schemas';
import * as orderService from './order.service';

export async function create(req: Request, res: Response) {
  const order = await orderService.createOrder(req.user!.id, parse(CreateOrderSchema, req.body));
  res.status(201).json(order);
}

export async function listMine(req: Request, res: Response) {
  res.json(await orderService.listMine(req.user!.id, parse(ListOrdersQuery, req.query)));
}

export async function getOne(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await orderService.getForUser(id, req.user!));
}

export async function cancel(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await orderService.cancelByCustomer(id, req.user!.id));
}

export async function listAll(req: Request, res: Response) {
  res.json(await orderService.listAll(parse(ListOrdersQuery, req.query)));
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  res.json(await orderService.updateStatus(id, req.user!.id, parse(UpdateStatusSchema, req.body)));
}

export async function updatePayment(req: Request, res: Response) {
  const { id } = parse(IdParams, req.params);
  const { paymentStatus } = parse(UpdatePaymentSchema, req.body);
  res.json(await orderService.updatePaymentStatus(id, paymentStatus));
}
