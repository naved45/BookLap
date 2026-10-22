import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/User.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const requireAuth = async (req, _res, next) => {
  try {
    const token = req.cookies?.bl_token;
    if (!token) throw new HttpError(401, 'Please log in.');
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(sub);
    if (!user || user.status !== 'active') throw new HttpError(401, 'Please log in.');
    req.user = user;
    next();
  } catch (e) { next(e instanceof HttpError ? e : new HttpError(401, 'Please log in.')); }
};
export const requireAdmin = (req, _res, next) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Not allowed.'));

// Strict schema validation: reject anything that does not match
export const validate = (schema, where = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) return next(r.error);
  req[where] = r.data;
  next();
};
export const validObjectId = (param) => (req, _res, next) =>
  mongoose.isValidObjectId(req.params[param]) ? next() : next(new HttpError(400, 'Invalid id.'));

const limiter = (max, windowMs) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
export const limits = {
  auth: () => limiter(config.rl.authMax, config.rl.authWindowMs),
  public: () => limiter(config.rl.publicMax, 15 * 60 * 1000),
  user: () => limiter(config.rl.userMax, 15 * 60 * 1000),
};

export const notFound = (_req, _res, next) => next(new HttpError(404, 'Not found.'));
// Never leak stack traces, paths or raw DB errors; log full details server-side only
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Invalid input.', details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large.' });
  if (err?.code === 11000) return res.status(409).json({ error: 'That value is already in use.' });
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
