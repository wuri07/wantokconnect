import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.');

// Public client: every query is limited by Row Level Security (see supabase/migrations/001_schema.sql).
export const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
