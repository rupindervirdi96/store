import type { Request, Response } from 'express';
import { parse } from '../../middleware/validate';
import { LoginSchema, RegisterSchema, ResendCodeSchema, VerifyEmailSchema } from './auth.schemas';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const result = await authService.register(parse(RegisterSchema, req.body));
  res.status(202).json(result);
}

export async function resendCode(req: Request, res: Response) {
  const { email } = parse(ResendCodeSchema, req.body);
  res.status(202).json(await authService.resendCode(email));
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmail(parse(VerifyEmailSchema, req.body));
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(parse(LoginSchema, req.body));
  res.json(result);
}
