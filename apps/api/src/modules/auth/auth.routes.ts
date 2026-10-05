import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from './auth.controller';

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts, please try again later' } },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, ctrl.register);
authRouter.post('/login', authLimiter, ctrl.login);
