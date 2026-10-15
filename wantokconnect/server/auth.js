import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { bad } from './db.js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const sbAuth = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Every /api route except /api/health uses this. Supabase checks the token; we only trust the id it returns.
export const requireAuth = wrap(async (req, _res, next) => {
  const h = req.get('authorization') || '', token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw bad('Please log in', 401);
  if (!sbAuth) throw bad('Server is missing SUPABASE_URL / SUPABASE_ANON_KEY', 503);
  const { data, error } = await sbAuth.auth.getUser(token);
  if (error || !data?.user) throw bad('Your session expired. Log in again.', 401);
  req.user = { id: data.user.id };
  next();
});

const safeEq = (a = '', b = '') => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export const requireAdmin = (req, _res, next) => {
  const t = process.env.ADMIN_API_TOKEN;
  if (!t || !safeEq(req.get('x-admin-token') || '', t)) return next(bad('Unauthorized', 401));
  next();
};

// Tiny in-memory limiter (per IP). Good enough for one Render instance.
export const rateLimit = (max, windowMs) => {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, _res, next) => { const n = (hits.get(req.ip) || 0) + 1; hits.set(req.ip, n); n > max ? next(bad('Too many requests. Try again in a minute.', 429)) : next(); };
};
