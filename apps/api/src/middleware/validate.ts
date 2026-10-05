import { Types } from 'mongoose';
import { z } from 'zod';

/**
 * Parses untrusted input against a Zod schema and returns the typed result.
 * A ZodError is thrown on failure and converted to a 400 by the error handler.
 *
 * Called inside controllers (rather than as route middleware) because Express 5
 * makes req.query read-only, and this keeps the parsed type flowing into code.
 */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: 'Invalid id' });

export const IdParams = z.object({ id: objectId });
