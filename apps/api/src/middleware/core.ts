import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import mongoose, { Types } from 'mongoose';
import { config } from '../config.js';
import { AppError, forbidden } from '../errors.js';
import { logger } from '../logger.js';
import { User } from '../models/index.js';

export interface AuthUser {
  id: Types.ObjectId;
  brandId: Types.ObjectId;
  role: 'OWNER' | 'STAFF';
  outletIds: Types.ObjectId[];
}
export interface AuthedRequest extends Request {
  user: AuthUser;
}

export const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req as AuthedRequest, res).catch(next);
  };

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** brandId, role and outlets come from the DB record of the token's subject, never from the client. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  let sub: string;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    sub = typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : '';
  } catch {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token'));
  }
  if (!Types.ObjectId.isValid(sub))
    return next(new AppError(401, 'UNAUTHENTICATED', 'Invalid token'));
  User.findById(sub)
    .lean()
    .then((u) => {
      if (!u) return next(new AppError(401, 'UNAUTHENTICATED', 'User no longer exists'));
      (req as AuthedRequest).user = {
        id: u._id,
        brandId: u.brandId,
        role: u.role,
        outletIds: u.outletIds,
      };
      next();
    })
    .catch(next);
};

export const requireOwner: RequestHandler = (req, _res, next) => {
  if ((req as AuthedRequest).user.role !== 'OWNER') return next(forbidden('Owner access required'));
  next();
};

export function validate<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function parseId(id: unknown, what = 'Resource'): Types.ObjectId {
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id) || id.length !== 24)
    throw new AppError(404, 'NOT_FOUND', `${what} not found`);
  return new Types.ObjectId(id);
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() },
    });
    return;
  }
  const e = err as { code?: number; type?: string };
  if (e.code === 11000) {
    res.status(409).json({ error: { code: 'DUPLICATE', message: 'Already exists' } });
    return;
  }
  if (e.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
};
