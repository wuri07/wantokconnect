import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, wrap } from '../auth.js';

export const directory = Router();
directory.use(requireAuth);

// Small business directory. Filters: region, province, category, name search. Verified storefronts are listed first.
directory.get('/', wrap(async (req, res) => {
  const { region, province, category } = req.query, search = String(req.query.q || '').trim().slice(0, 60), page = Math.max(0, Number(req.query.page) || 0);
  const r = await q(`select u.id, u.full_name, u.profile_pic_url, left(u.bio, 200) as bio, (u.storefront_status = 'verified') as verified,
      coalesce(u.whatsapp_number, u.phone_number) as whatsapp,
      coalesce(jsonb_agg(distinct jsonb_build_object('province', pr.name, 'city', ch.name)) filter (where pr.id is not null), '[]') as locations,
      coalesce(array_agg(distinct c.name) filter (where c.id is not null), '{}') as categories
    from users u
    left join business_locations bl on bl.user_id = u.id
    left join provinces pr on pr.id = bl.province_id
    left join city_hubs ch on ch.id = bl.city_hub_id
    left join sme_products sp on sp.user_id = u.id
    left join categories c on c.id = sp.category_id
    where u.account_type = 'sme_owner'
      and ($1::int is null or pr.region_id = $1) and ($2::int is null or pr.id = $2) and ($3::int is null or sp.category_id = $3)
      and ($4::text = '' or position(lower($4) in lower(u.full_name)) > 0)
    group by u.id
    order by (u.storefront_status = 'verified') desc, u.full_name
    limit 20 offset $5`, [region || null, province || null, category || null, search, page * 20]);
  res.json({ data: r.rows });
}));
