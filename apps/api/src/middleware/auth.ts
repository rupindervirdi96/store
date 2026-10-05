import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@store/shared';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Rejects the request with 401 unless a valid JWT is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (!token) return next(AppError.unauthorized());
  try {
    const { sub, role } = verifyToken(token);
    req.user = { id: sub, role };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

/** Attaches req.user when a valid token is present but never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  if (token) {
    try {
      const { sub, role } = verifyToken(token);
      req.user = { id: sub, role };
    } catch {
      // Ignore bad tokens on public routes.
    }
  }
  next();
}

/** Must be used after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}

export const requireAdmin = [requireAuth, requireRole('admin')];
