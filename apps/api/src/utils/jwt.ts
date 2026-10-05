import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@store/shared';
import { env } from '../config/env';

export interface AuthTokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
    throw new Error('Malformed token');
  }
  return { sub: decoded.sub, role: decoded.role as Role };
}
