import { Router } from 'express';
import { pool } from '../db.js';

// Share links such as https://your-site/p/123 show a proper preview (title, price, photo) when pasted into WhatsApp or Facebook,
// then send people on to the app. Only public marketplace information is used.
export const share = Router();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kina = p => Number(p) > 0 ? 'K' + Number(p).toFixed(2) : 'Ask for price';
const isId = v => /^\d{1,12}$/.test(v);

function html(req, { title, desc, image, to }) {
  const base = `${req.protocol}://${req.get('host')}`, img = image || `${base}/icons/icon-512.png`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:site_name" content="WantokConnect"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(base + req.originalUrl)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(to)}"></head><body style="background:#09090B;color:#F8FAFC;font-family:system-ui,sans-serif"><p>Opening WantokConnect... <a style="color:#FFD700" href="${esc(to)}">Continue</a></p><script>location.replace(${JSON.stringify(to)})</script></body></html>`;
}
const send = (req, res, page) => res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }).send(html(req, page));
const fallback = req => ({ title: 'WantokConnect Market', desc: 'Local products and services from small businesses across Papua New Guinea.', image: null, to: '/' });

share.get('/p/:id', async (req, res) => {
  const id = req.params.id; if (!isId(id)) return res.redirect('/');
  let page = { ...fallback(req), to: `/#/post/${id}` };
  try {
    const r = pool && await pool.query(`select p.content, u.full_name, sp.product_name, sp.price_kina, coalesce(ch.name || ', ', '') || pr.name as loc,
        (select url from post_media m where m.post_id = p.id and m.kind = 'image' order by sort_order limit 1) as image
      from marketplace_posts p join users u on u.id = p.user_id join business_locations bl on bl.id = p.location_id join provinces pr on pr.id = bl.province_id
      left join city_hubs ch on ch.id = bl.city_hub_id left join sme_products sp on sp.id = p.product_id where p.id = $1`, [id]);
    const row = r?.rows[0];
    if (row) page = { title: `${row.product_name || 'Listing'} | ${row.full_name}`, desc: `${kina(row.price_kina)} - ${row.loc}. ${String(row.content).slice(0, 140)}`, image: row.image, to: `/#/post/${id}` };
  } catch { /* fall back to the generic preview */ }
  send(req, res, page);
});
share.get('/i/:id', async (req, res) => {
  const id = req.params.id; if (!isId(id)) return res.redirect('/');
  let page = fallback(req);
  try {
    const r = pool && await pool.query(`select sp.id, sp.user_id, sp.product_name, sp.description, sp.price_kina, sp.media_url, u.full_name, coalesce(ch.name || ', ', '') || pr.name as loc
      from sme_products sp join users u on u.id = sp.user_id left join business_locations bl on bl.id = sp.location_id left join provinces pr on pr.id = bl.province_id left join city_hubs ch on ch.id = bl.city_hub_id where sp.id = $1`, [id]);
    const row = r?.rows[0];
    if (row) page = { title: `${row.product_name} | ${row.full_name}`, desc: `${kina(row.price_kina)}${row.loc ? ' - ' + row.loc : ''}. ${String(row.description).slice(0, 140)}`, image: row.media_url, to: `/#/catalog/${row.user_id}/${row.id}` };
  } catch { /* fall back to the generic preview */ }
  send(req, res, page);
});
