// App shell cache so the site opens without signal. API calls are never cached here (the app caches feeds in IndexedDB).
const V = 'wc-shell-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.add('/')).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/sw.js') return;
  if (r.mode === 'navigate') {                       // pages: network first, cached shell when offline
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put('/', c)); return res; }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })));   // hashed assets: cache first
});
