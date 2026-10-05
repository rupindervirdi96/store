import type { Request, Response } from 'express';
import { parse } from '../../middleware/validate';
import { LoginSchema, RegisterSchema } from './auth.schemas';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const result = await authService.register(parse(RegisterSchema, req.body));
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(parse(LoginSchema, req.body));
  res.json(result);
}
