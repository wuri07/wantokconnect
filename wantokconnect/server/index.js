import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { rateLimit } from './auth.js';
import { network } from './routes/network.js';
import { directory } from './routes/directory.js';
import { verification } from './routes/verification.js';
import { sync } from './routes/sync.js';
import { admin } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '../dist');
const app = express();
app.set('trust proxy', 1);                       // Render sits behind a proxy
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' }); next(); });

app.get('/api/health', async (_req, res) => {
  try { if (pool) await pool.query('select 1'); res.json({ ok: true, db: Boolean(pool) }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api', rateLimit(300, 60_000));
app.use('/api/network', network);
app.use('/api/directory', directory);
app.use('/api/verification', verification);
app.use('/api/sync', sync);
app.use('/api/admin', admin);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built front end. If the build never ran, say so clearly instead of crashing.
if (!fs.existsSync(path.join(dist, 'index.html'))) console.error('dist/index.html not found. Run "npm run build" before "npm start".');
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('/sw.js', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'sw.js')));
app.get('*', (_req, res) => {
  const f = path.join(dist, 'index.html');
  fs.existsSync(f) ? res.sendFile(f) : res.status(503).send('The site has not been built yet. Run: npm run build');
});
app.use((err, _req, res, _next) => { if (!err.status) console.error(err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' }); });
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('WantokConnect listening on ' + (process.env.PORT || 3000)));
