import { sb } from './supabase.js';
import { S, $, toast } from './ui.js';

/* Offline-first: an IndexedDB outbox queues actions made without signal; they replay through POST /api/sync when signal returns.
   A second store caches the last feeds so they can be read offline. */
const idb = () => new Promise((ok, no) => {
  const r = indexedDB.open('wc-offline', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('outbox', { keyPath: 'id' }); r.result.createObjectStore('cache'); };
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (store, mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction(store, mode), req = fn(t.objectStore(store)); t.oncomplete = () => ok(req && req.result); t.onerror = () => no(t.error); }); };
export const cacheSet = (k, v) => tx('cache', 'readwrite', s => s.put(v, k)).catch(() => {});
export const cacheGet = k => tx('cache', 'readonly', s => s.get(k)).catch(() => undefined);
const all = () => tx('outbox', 'readonly', s => s.getAll()).then(x => x || []).catch(() => []);

export async function enqueue(type, payload, id = crypto.randomUUID()) { await tx('outbox', 'readwrite', s => s.put({ id, type, payload, ts: Date.now() })); await pill(); return id; }

export async function pill() {
  const el = $('#off'), n = (await all()).length;
  if (!navigator.onLine) { el.textContent = 'Offline mode: changes will sync when signal returns' + (n ? ` (${n} waiting)` : ''); el.hidden = false; }
  else if (n) { el.textContent = `Syncing ${n} change${n > 1 ? 's' : ''}...`; el.hidden = false; }
  else el.hidden = true;
}
let busy = false;
export async function flush() {
  if (busy || !navigator.onLine || !S.user) return;
  busy = true;
  try {
    const items = await all(); if (!items.length) return;
    const { data } = await sb.auth.getSession(); if (!data.session) return;
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ actions: items.slice(0, 50) }) });
    if (!res.ok) return;
    const { results } = await res.json();
    for (const r of results) if (r.ok || !r.retry) await tx('outbox', 'readwrite', s => s.delete(r.id));
    if (results.some(r => r.ok)) toast('Offline changes synced');
    window.dispatchEvent(new Event('wc-synced'));
  } catch { /* try again on the next online event */ }
  finally { busy = false; await pill(); }
}
export function initOffline() {
  addEventListener('online', () => { pill(); flush(); }); addEventListener('offline', pill);
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
  pill(); flush();
}
