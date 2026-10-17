import crypto from 'node:crypto';
import { bad } from './db.js';

export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const safeEq = (a = '', b = '') => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export const requireAdmin = (req, _res, next) => {
  const t = process.env.ADMIN_API_TOKEN;
  if (!t || !safeEq(req.get('x-admin-token') || '', t)) return next(bad('Unauthorized', 401));
  next();
};
// Tiny in-memory limiter (per IP). Good enough for one Render instance.
export const rateLimit = (max, windowMs) => {
  const hits = new Map(); setInterval(() => hits.clear(), windowMs).unref();
  return (req, _res, next) => { const n = (hits.get(req.ip) || 0) + 1; hits.set(req.ip, n); n > max ? next(bad('Too many requests. Try again in a minute.', 429)) : next(); };
};
