import { sb } from './supabase.js';
import { S, $, esc, toast, avatar, pick, uploadOne, locLabel, waLink } from './ui.js';
import { vbadge, stockBadge, priceTxt, toggleConn, openPostSheet } from './feed.js';

const catOpts = () => S.ref.cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const provOpts = () => S.ref.regions.map(r => `<optgroup label="${esc(r.name)}">${S.ref.provinces.filter(p => p.region_id === r.id).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
const cityOpts = prov => '<option value="">No city hub</option>' + S.ref.cities.filter(c => !prov || c.province_id == prov).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const sec = (t, h) => `<section class="sec"><h2>${t}</h2>${h}</section>`;
let cache = {};

export async function renderProfile(id) {
  const app = $('#app'); app.innerHTML = '<p class="pad muted">Loading...</p>';
  const [{ data: u }, { data: cnt }] = await Promise.all([sb.from('users').select('*').eq('id', id).maybeSingle(), sb.rpc('connection_count', { p_user: id })]);
  if (!u) { app.innerHTML = '<p class="pad muted">Profile not found.</p>'; return; }
  const own = id === S.user.id, sme = u.account_type === 'sme_owner'; let locs = [], photos = [], prods = [];
  if (sme) {
    const r = await Promise.all([
      sb.from('business_locations').select('id,province_id,city_hub_id,provinces(name),city_hubs(name)').eq('user_id', id),
      sb.from('storefront_photos').select('*').eq('user_id', id).order('sort_order').order('created_at'),
      sb.from('sme_products').select('*,categories(name),business_locations(provinces(name),city_hubs(name))').eq('user_id', id).order('created_at', { ascending: false })]);
    [locs, photos, prods] = r.map(x => x.data || []); if (own) S.myLocs = locs;
  }
  cache = { u, locs, photos, prods };
  const n = cnt ?? 0, btn = (c, t, a) => `<button class="btn ${c}" data-a="${a}">${t}</button>`;
  const wa = sme && !own ? waLink(u.whatsapp_number || u.phone_number, 'Hi, I found you on WantokConnect.') : '';
  let h = `<button class="back" data-a="back">&larr; Back</button><section class="sec"><div class="row" style="gap:16px;flex-wrap:nowrap">${avatar(u.profile_pic_url, u.full_name, 'xl')}<div class="grow">${own ? `<input id="pnm" class="in" maxlength="100" value="${esc(u.full_name)}" aria-label="${sme ? 'Business name' : 'Name'}" style="font-weight:700;font-size:18px">` : `<h1 style="margin:0;font-size:20px">${esc(u.full_name)}</h1>`}<div class="sub" style="font-size:14px">${n} connection${n === 1 ? '' : 's'} &middot; ${sme ? 'Business' : 'Customer'}</div></div></div>
   ${own ? `<div class="row" style="margin-top:16px">${btn('gold-o', 'Change photo', 'pic')}${btn('red', 'Save', 'savep')}</div>` : ''}
   ${sme ? `<div style="margin-top:12px">${u.storefront_status === 'verified' ? vbadge.replace('margin-left:6px', '') : own ? (u.storefront_status === 'pending' ? '<span class="tiny gold">Storefront verification pending</span>' : '<button class="chip tag" data-a="verify">Request Physical Storefront Verified</button>') : ''}</div>` : ''}
   ${own ? '' : `<div class="row" style="margin-top:16px">${btn(S.conn.has(id) ? 'gold-o' : 'red', S.conn.has(id) ? 'Connected' : 'Connect', 'conn|' + id)}${btn('gold-o', 'Message', 'msg|' + id)}${wa ? `<a class="btn red" href="${esc(wa)}" target="_blank" rel="noopener">Arrange on WhatsApp</a>` : ''}</div>`}</section>`;
  if (!sme) return app.innerHTML = h + sec('About', own ? `<textarea id="pbio" class="in" rows="3" maxlength="600" placeholder="Tell businesses about yourself">${esc(u.bio)}</textarea>${btn('red', 'Save', 'savep')}` : `<p class="muted sm" style="margin:0">${esc(u.bio) || 'No bio yet.'}</p>`);
  h += sec('Locations available', `<div class="row">${locs.map(l => `<span class="chip">${esc(locLabel(l))}${own && locs.length > 1 ? ` <button data-a="ldel|${l.id}" style="color:var(--red);padding-left:4px" aria-label="Remove location">&times;</button>` : ''}</span>`).join('') || '<span class="muted sm">No locations yet. Add one to start posting.</span>'}</div>
    ${own ? `<div class="grid2" style="margin-top:12px"><select id="lp" class="in" aria-label="Province">${provOpts()}</select><select id="lc" class="in" aria-label="City hub">${cityOpts(S.ref.provinces[0]?.id)}</select></div>${btn('gold-o', 'Add location', 'ladd')}` : ''}`);
  h += sec('Storefront photos', `<div class="thumbs">${photos.map(p => `<div class="th"><img src="${esc(p.image_url)}" loading="lazy" alt="Storefront">${own ? `<button class="x" data-a="gdel|${p.id}" aria-label="Remove photo">&times;</button>` : ''}</div>`).join('')}</div>${photos.length ? '' : '<p class="muted sm" style="margin:0">No storefront photos yet.</p>'}${own ? `<div style="margin-top:12px">${btn('gold-o', 'Add photos', 'gadd')}</div>` : ''}`);
  h += sec('Products and services', prods.map(p => `<div class="item"><div class="between" style="margin:0;align-items:flex-start"><div class="grow"><b class="sm">${esc(p.product_name)}</b><div class="sub">${priceTxt(p.price_kina)} &middot; ${esc(p.categories?.name || '')}</div></div>
    ${own ? `<button class="sw ${p.is_in_stock ? 'on' : ''}" data-a="stock|${p.id}" role="switch" aria-checked="${p.is_in_stock}" aria-label="In stock: ${esc(p.product_name)}"><span style="color:${p.is_in_stock ? 'var(--gold)' : 'var(--red)'}">${p.is_in_stock ? 'In Stock' : 'Out of Stock'}</span><i></i></button>` : stockBadge(p.is_in_stock)}</div>
    ${p.media_url ? `<img src="${esc(p.media_url)}" loading="lazy" alt="">` : ''}<p class="muted sm" style="margin:8px 0 0">${esc(p.description)}</p><div class="tiny muted" style="margin-top:4px">Available: ${esc(p.business_locations ? locLabel(p.business_locations) : 'Ask the seller')}</div>
    ${own ? `<div class="row" style="margin-top:12px;gap:16px">${btn('gold-o', 'Post', 'ppost|' + p.id)}<button class="tiny" style="color:var(--red)" data-a="pdel|${p.id}">Remove</button></div>` : ''}</div>`).join('') || '<p class="muted sm" style="margin:0">No products yet.</p>'
    + (own ? `<div style="margin-top:16px"><div class="b sm" style="margin-bottom:8px">Add a product or service</div><input id="pn1" class="in" maxlength="150" placeholder="Name"><div class="grid2"><select id="pc1" class="in" aria-label="Category">${catOpts()}</select><input id="pp1" class="in" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Price in K (optional)"></div><select id="pl1" class="in" aria-label="Location">${S.myLocs.map(l => `<option value="${l.id}">${esc(locLabel(l))}</option>`).join('')}</select><textarea id="pd1" class="in" rows="2" placeholder="Description"></textarea><div class="row">${btn('gold-o', 'Add photo', 'npph')}${btn('red', 'Add to catalog', 'padd')}</div><p class="tiny muted" id="npv"></p><p class="err" id="per"></p></div>` : ''));
  h += sec('About and contact', own ? `<textarea id="pbio" class="in" rows="3" maxlength="600" placeholder="About your business">${esc(u.bio)}</textarea><input id="pwa" class="in" inputmode="tel" placeholder="WhatsApp number, e.g. +67572345678" value="${esc(u.whatsapp_number)}"><input id="pph" class="in" inputmode="tel" placeholder="Phone number" value="${esc(u.phone_number)}"><input id="pgm" class="in" type="email" placeholder="Gmail" value="${esc(u.gmail)}">${btn('red', 'Save', 'savep')}`
    : `<p class="muted sm" style="margin:0;line-height:1.6">${esc(u.bio) || 'No description yet.'}</p><div style="margin-top:12px;display:grid;gap:8px" class="sm">${u.whatsapp_number ? `<a class="gold" target="_blank" rel="noopener" href="${esc(waLink(u.whatsapp_number, 'Hi'))}">WhatsApp: ${esc(u.whatsapp_number)}</a>` : ''}${u.phone_number ? `<a class="gold" href="tel:${esc(u.phone_number)}">Phone: ${esc(u.phone_number)}</a>` : ''}${u.gmail ? `<a class="gold" href="mailto:${esc(u.gmail)}">Gmail: ${esc(u.gmail)}</a>` : ''}</div>`);
  app.innerHTML = h;
}
const val = id => ($(id)?.value || '').trim(), redo = () => renderProfile(S.view.id);
let npImg = null;
const run = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Something went wrong'); } };

export const profileActions = {
  back: () => { location.hash = '#/'; },
  pic: () => run(async () => { const [f] = await pick('image/*'); if (!f) return; const r = await uploadOne('avatars', f, 256); const { error } = await sb.from('users').update({ profile_pic_url: r.url }).eq('id', S.user.id); if (error) throw error; S.user.profile_pic_url = r.url; redo(); }),
  savep: () => run(async () => {
    const row = {}; if ($('#pnm')) row.full_name = val('#pnm'); if ($('#pbio')) row.bio = val('#pbio') || null;
    if ($('#pwa')) Object.assign(row, { whatsapp_number: val('#pwa') || null, phone_number: val('#pph') || null, gmail: val('#pgm') || null });
    if (row.full_name !== undefined && row.full_name.length < 2) throw new Error('Enter a name');
    const { error } = await sb.from('users').update(row).eq('id', S.user.id); if (error) throw new Error(/check constraint/i.test(error.message) ? 'Check your phone number (use digits, e.g. +67572345678) and email' : error.message);
    Object.assign(S.user, row); toast('Saved'); redo();
  }),
  verify: () => run(async () => { const { error } = await sb.from('users').update({ storefront_status: 'pending' }).eq('id', S.user.id); if (error) throw error; S.user.storefront_status = 'pending'; toast('Request sent. Add storefront photos so we can verify you.'); redo(); }),
  ladd: () => run(async () => { const { error } = await sb.from('business_locations').insert({ user_id: S.user.id, province_id: +$('#lp').value, city_hub_id: $('#lc').value ? +$('#lc').value : null }); if (error) throw new Error(/duplicate/i.test(error.message) ? 'You already added that location' : /foreign key/i.test(error.message) ? 'That city is not in that province' : error.message); redo(); }),
  ldel: id => run(async () => { if (!confirm('Removing a location also removes the posts made for it. Continue?')) return; const { error } = await sb.from('business_locations').delete().eq('id', id); if (error) throw error; redo(); }),
  gadd: () => run(async () => { const fs = await pick('image/*', true); for (const f of fs) { const r = await uploadOne('storefronts', f, 1024); const { error } = await sb.from('storefront_photos').insert({ user_id: S.user.id, image_url: r.url }); if (error) throw error; } redo(); }),
  gdel: id => run(async () => { const { error } = await sb.from('storefront_photos').delete().eq('id', id); if (error) throw error; redo(); }),
  // Flipping this updates sme_products; a database trigger notifies connected customers and Realtime refreshes every open feed.
  stock: id => run(async () => { const p = cache.prods.find(x => x.id == id); const { error } = await sb.from('sme_products').update({ is_in_stock: !p.is_in_stock }).eq('id', id); if (error) throw error; redo(); }),
  pdel: id => run(async () => { if (!confirm('Remove this item from your catalog?')) return; const { error } = await sb.from('sme_products').delete().eq('id', id); if (error) throw error; redo(); }),
  npph: () => run(async () => { const [f] = await pick('image/*'); if (!f) return; npImg = f; $('#npv').textContent = 'Photo ready: ' + f.name; }),
  padd: () => run(async () => {
    const er = $('#per'), name = val('#pn1'), d = val('#pd1'), price = parseFloat($('#pp1').value);
    if (!name) return er.textContent = 'Enter a name.'; if (d.length < 5) return er.textContent = 'Add a short description.'; if (!$('#pl1').value) return er.textContent = 'Add a location first.';
    const img = npImg ? await uploadOne('post-media', npImg, 1024) : null;
    const { error } = await sb.from('sme_products').insert({ user_id: S.user.id, product_name: name, description: d, category_id: +$('#pc1').value, price_kina: price >= 0 ? price : null, location_id: +$('#pl1').value, media_url: img?.url || null });
    if (error) throw error; npImg = null; redo();
  }),
  ppost: id => { const p = cache.prods.find(x => x.id == id); if (p) openPostSheet(p); },
};
profileActions.conn = id => toggleConn(id);
document.addEventListener('change', e => { if (e.target.id === 'lp') $('#lc').innerHTML = cityOpts(e.target.value); });
