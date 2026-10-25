import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { rateLimit } from './auth.js';
import { admin } from './routes/admin.js';
import { share } from './routes/share.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '../dist');
const app = express();
app.set('trust proxy', 1);                       // Render sits behind a proxy
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' }); next(); });

// The app talks to Supabase directly from the browser. This server only serves the site, a health check and the admin badge review.
app.get('/api/health', async (_req, res) => {
  try { if (pool) await pool.query('select 1'); res.json({ ok: true, db: Boolean(pool) }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api/admin', rateLimit(60, 60_000), admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(rateLimit(120, 60_000), share);      // /p/:id and /i/:id share links with previews

if (!fs.existsSync(path.join(dist, 'index.html'))) console.error('dist/index.html not found. Run "npm run build" before "npm start".');
app.use('/.well-known', express.static(path.join(dist, '.well-known'), { dotfiles: 'allow' }));   // Android app link verification (assetlinks.json)
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('/sw.js', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'sw.js')));
app.get('*', (_req, res) => {
  const f = path.join(dist, 'index.html');
  fs.existsSync(f) ? res.sendFile(f) : res.status(503).send('The site has not been built yet. Run: npm run build');
});
app.use((err, _req, res, _next) => { if (!err.status) console.error(err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' }); });
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('WantokConnect listening on ' + (process.env.PORT || 3000)));
