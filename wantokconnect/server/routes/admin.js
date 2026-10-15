import { Router } from 'express';
import { q, bad } from '../db.js';
import { requireAdmin, wrap } from '../auth.js';

export const admin = Router();
admin.use(requireAdmin);   // header: x-admin-token

admin.get('/verifications', wrap(async (_req, res) => {
  const [ids, shops] = await Promise.all([
    q(`select u.id, u.full_name, pp.updated_at from professional_profiles pp join users u on u.id = pp.user_id where pp.national_id_status = 'pending' order by pp.updated_at`),
    q(`select u.id, u.full_name, (select array_agg(image_url) from storefront_photos where user_id = u.id) as photos from users u where u.storefront_status = 'pending'`)]);
  res.json({ national_id: ids.rows, storefront: shops.rows });
}));
const STATUS = ['verified', 'rejected', 'none'];
admin.post('/national-id/:id', wrap(async (req, res) => {
  if (!STATUS.includes(req.body?.status)) throw bad('Bad status');
  const r = await q(`update professional_profiles set national_id_status = $1, verified_at = case when $1 = 'verified' then now() end where user_id = $2 returning user_id`, [req.body.status, req.params.id]);
  r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
}));
admin.post('/storefront/:id', wrap(async (req, res) => {
  if (!STATUS.includes(req.body?.status)) throw bad('Bad status');
  const r = await q(`update users set storefront_status = $1, storefront_verified_at = case when $1 = 'verified' then now() end where id = $2 and account_type = 'sme_owner' returning id`, [req.body.status, req.params.id]);
  r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
}));
