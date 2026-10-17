import pg from 'pg';

// One small pool for the whole server. Use the Supabase TRANSACTION pooler string (port 6543) in DATABASE_URL.
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000, ssl: { rejectUnauthorized: false } })
  : null;

export const q = (text, params) => {
  if (!pool) throw Object.assign(new Error('Database is not configured (set DATABASE_URL)'), { status: 503 });
  return pool.query(text, params);
};
export const bad = (message, status = 400) => Object.assign(new Error(message), { status });
