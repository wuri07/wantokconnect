import { sb } from './supabase.js';

// Calls the Express API with the signed-in user's token.
export async function api(path, { method = 'GET', body } = {}) {
  const { data } = await sb.auth.getSession(), token = data.session?.access_token;
  if (!token) throw new Error('Please log in again');
  const r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
// True when a request failed because there is no signal (as opposed to the server saying no).
export const isNet = e => e instanceof TypeError || !navigator.onLine;
