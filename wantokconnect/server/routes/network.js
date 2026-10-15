import { Router } from 'express';
import { q, bad } from '../db.js';
import { requireAuth, wrap } from '../auth.js';

const TYPES = ['job_opening', 'offer_service', 'industry_question', 'company_news', 'achievement'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = v => UUID.test(String(v));

/* ---- shared by the REST routes and by /api/sync (offline queue). Every function is safe to retry. ---- */
export async function createPost(uid, b) {
  if (!TYPES.includes(b.type)) throw bad('Choose a post type');
  const hub = Number(b.hub_id); if (!hub) throw bad('Choose an industry hub');
  const text = String(b.content || '').trim(); if (text.length < 10 || text.length > 1000) throw bad('Posts need 10 to 1000 characters');
  if (b.client_uuid && !isId(b.client_uuid)) throw bad('Bad request id');
  const r = await q(`insert into pro_posts (user_id, post_type, hub_id, province_id, content, client_uuid)
    values ($1, $2, $3, coalesce($4::smallint, (select province_id from professional_profiles where user_id = $1)), $5, $6)
    on conflict (client_uuid) do nothing returning id`, [uid, b.type, hub, b.province_id || null, text, b.client_uuid || null]);
  return { id: r.rows[0]?.id ?? null, duplicate: !r.rowCount };
}
export async function setReaction(uid, postId, kind, on) {
  if (!['vouched', 'resourceful'].includes(kind) || !Number(postId)) throw bad('Bad reaction');
  on ? await q('insert into pro_reactions (post_id, user_id, kind) values ($1, $2, $3) on conflict do nothing', [postId, uid, kind])
     : await q('delete from pro_reactions where post_id = $1 and user_id = $2 and kind = $3', [postId, uid, kind]);
}
export async function setConnection(uid, target, on) {
  if (!isId(target) || target === uid) throw bad('Bad connection request');
  on ? await q('insert into user_connections (follower_id, following_id) values ($1, $2) on conflict do nothing', [uid, target])
     : await q('delete from user_connections where follower_id = $1 and following_id = $2', [uid, target]);
}

export const network = Router();
network.use(requireAuth);

// Structured feed: ranked by usefulness (Vouched x2 + Resourceful) with age decay, so low-utility posts sink.
network.get('/feed', wrap(async (req, res) => {
  const { hub, province, type } = req.query, page = Math.max(0, Number(req.query.page) || 0);
  if (type && !TYPES.includes(type)) throw bad('Unknown post type');
  const r = await q(`select p.id, p.post_type, p.content, p.created_at, p.vouched_count, p.resourceful_count, p.user_id,
      u.full_name, u.profile_pic_url, pp.headline, coalesce(pp.national_id_status = 'verified', false) as id_verified,
      h.name as hub_name, pr.name as province_name,
      exists (select 1 from pro_reactions x where x.post_id = p.id and x.user_id = $1 and x.kind = 'vouched') as i_vouched,
      exists (select 1 from pro_reactions x where x.post_id = p.id and x.user_id = $1 and x.kind = 'resourceful') as i_resourceful
    from pro_posts p join users u on u.id = p.user_id
    left join professional_profiles pp on pp.user_id = p.user_id left join hubs h on h.id = p.hub_id left join provinces pr on pr.id = p.province_id
    where ($2::int is null or p.hub_id = $2) and ($3::int is null or p.province_id = $3) and ($4::text is null or p.post_type = $4)
    order by (p.vouched_count * 2 + p.resourceful_count) / power(extract(epoch from now() - p.created_at) / 3600 + 2, 1.3) desc, p.created_at desc
    limit 20 offset $5`, [req.user.id, hub || null, province || null, type || null, page * 20]);
  res.json({ data: r.rows });
}));
network.post('/posts', wrap(async (req, res) => res.status(201).json(await createPost(req.user.id, req.body || {}))));
network.post('/posts/:id/react', wrap(async (req, res) => { await setReaction(req.user.id, req.params.id, req.body?.kind, !!req.body?.on); res.json({ ok: true }); }));
network.post('/connect/:id', wrap(async (req, res) => { await setConnection(req.user.id, req.params.id, !!req.body?.on); res.json({ ok: true }); }));

network.get('/profile/:id', wrap(async (req, res) => {
  const id = req.params.id === 'me' ? req.user.id : req.params.id; if (!isId(id)) throw bad('Bad id');
  const r = await q(`select u.id, u.full_name, u.profile_pic_url, pp.headline, pp.bio, pp.skills, pp.hub_id, pp.province_id, coalesce(pp.national_id_status, 'none') as national_id_status
    from users u left join professional_profiles pp on pp.user_id = u.id where u.id = $1`, [id]);
  r.rowCount ? res.json(r.rows[0]) : res.status(404).json({ error: 'Not found' });
}));
network.put('/profile/me', wrap(async (req, res) => {
  const b = req.body || {}, headline = String(b.headline || '').trim().slice(0, 150), bio = String(b.bio || '').trim().slice(0, 1000);
  const skills = (Array.isArray(b.skills) ? b.skills : []).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 15);
  if (!Number(b.hub_id)) throw bad('Choose your industry hub');
  await q(`insert into professional_profiles (user_id, headline, hub_id, bio, skills, province_id) values ($1, $2, $3, $4, $5, $6)
    on conflict (user_id) do update set headline = $2, hub_id = $3, bio = $4, skills = $5, province_id = $6, updated_at = now()`,
    [req.user.id, headline, Number(b.hub_id), bio, skills, Number(b.province_id) || null]);
  res.json({ ok: true });
}));
