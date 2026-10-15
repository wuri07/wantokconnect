import { Router } from 'express';
import crypto from 'node:crypto';
import { q, bad } from '../db.js';
import { requireAuth, wrap } from '../auth.js';

export const verification = Router();
verification.use(requireAuth);

verification.get('/status', wrap(async (req, res) => {
  const r = await q(`select u.account_type, u.storefront_status, coalesce(pp.national_id_status, 'none') as national_id_status,
      (select count(*)::int from storefront_photos where user_id = u.id) as photos
    from users u left join professional_profiles pp on pp.user_id = u.id where u.id = $1`, [req.user.id]);
  res.json(r.rows[0] || {});
}));

// National ID: we store only a keyed hash (HMAC with ID_PEPPER), never the number. A reviewer then approves it.
verification.post('/national-id', wrap(async (req, res) => {
  const pepper = process.env.ID_PEPPER; if (!pepper) throw bad('Verification is not configured yet', 503);
  const id = String(req.body?.id_number || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,20}$/.test(id)) throw bad('Enter your National ID number using letters, numbers and dashes only');
  const hash = crypto.createHmac('sha256', pepper).update(id).digest('hex');
  try {
    const r = await q(`insert into professional_profiles (user_id, national_id_hash, national_id_status)
      values ($1, $2, 'pending')
      on conflict (user_id) do update set national_id_hash = $2, national_id_status = 'pending', updated_at = now()
      where professional_profiles.national_id_status <> 'verified' returning national_id_status`, [req.user.id, hash]);
    if (!r.rowCount) throw bad('You are already verified');
    res.json({ status: 'pending' });
  } catch (e) { if (e.code === '23505') throw bad('That ID is already linked to another account', 409); throw e; }
}));

verification.post('/storefront', wrap(async (req, res) => {
  const r = await q(`select account_type, storefront_status, (select count(*)::int from storefront_photos where user_id = $1) as photos from users where id = $1`, [req.user.id]);
  const u = r.rows[0];
  if (!u || u.account_type !== 'sme_owner') throw bad('Only business owners can request storefront verification');
  if (u.storefront_status === 'verified') throw bad('Your storefront is already verified');
  if (u.photos < 1) throw bad('Add at least one storefront photo in your profile first');
  await q(`update users set storefront_status = 'pending' where id = $1`, [req.user.id]);
  res.json({ status: 'pending' });
}));
