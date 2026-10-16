import { Router } from 'express';
import { q, bad } from '../db.js';
import { requireAdmin, wrap } from '../auth.js';

export const admin = Router();
admin.use(requireAdmin);   // header: x-admin-token

// Businesses waiting for a Physical Storefront Verified badge, with their storefront photos.
admin.get('/storefronts', wrap(async (_req, res) => {
  const r = await q(`select u.id, u.full_name, (select array_agg(image_url) from storefront_photos where user_id = u.id) as photos from users u where u.storefront_status = 'pending'`);
  res.json({ pending: r.rows });
}));
admin.post('/storefront/:id', wrap(async (req, res) => {
  if (!['verified', 'rejected', 'none'].includes(req.body?.status)) throw bad('Bad status');
  const r = await q(`update users set storefront_status = $1, storefront_verified_at = case when $1 = 'verified' then now() end where id = $2 and account_type = 'sme_owner' returning id`, [req.body.status, req.params.id]);
  r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Business owner not found' });
}));
