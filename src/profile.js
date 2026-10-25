import { sb } from './supabase.js';
import { S, $, esc, toast, avatar, pick, uploadOne, locLabel, waLink } from './ui.js';
import { vbadge, stockBadge, priceTxt, toggleConn } from './feed.js';
import { openLightbox } from './lightbox.js';

const catOpts = () => S.ref.cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const provOpts = () => S.ref.regions.map(r => `<optgroup label="${esc(r.name)}">${S.ref.provinces.filter(p => p.region_id === r.id).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
const cityOpts = prov => '<option value="">No city hub</option>' + S.ref.cities.filter(c => !prov || c.province_id == prov).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const sec = (t, h) => `<section class="sec s-${t.toLowerCase().replace(/[^a-z]+/g, '-')}"><h2>${t}</h2>${h}</section>`;
let cache = {};

export async function renderProfile(id) {
  const app = $('#app'); app.className = 'wrap pgrid'; app.innerHTML = '<p class="pad muted">Loading...</p>';
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
  if (!sme) return app.innerHTML = h + (own ? sec('Own a business?', `<p class="muted sm" style="margin-top:0">Switch to a business account to add locations, list products and post to the feed. This cannot be undone.</p>${btn('gold-o', 'Switch to a business account', 'tobiz')}`) : '') + sec('About', own ? `<textarea id="pbio" class="in" rows="3" maxlength="600" placeholder="Tell businesses about yourself">${esc(u.bio)}</textarea>${btn('red', 'Save', 'savep')}` : `<p class="muted sm" style="margin:0">${esc(u.bio) || 'No bio yet.'}</p>`);
  h += sec('Locations available', `<div class="row">${locs.map(l => `<span class="chip">${esc(locLabel(l))}${own && locs.length > 1 ? ` <button data-a="ldel|${l.id}" style="color:var(--red);padding-left:4px" aria-label="Remove location">&times;</button>` : ''}</span>`).join('') || '<span class="muted sm">No locations yet. Add one to start posting.</span>'}</div>
    ${own ? `<div class="grid2" style="margin-top:12px"><select id="lp" class="in" aria-label="Province">${provOpts()}</select><select id="lc" class="in" aria-label="City hub">${cityOpts(S.ref.provinces[0]?.id)}</select></div>${btn('gold-o', 'Add location', 'ladd')}` : ''}`);
  h += sec('Storefront photos', `<div class="thumbs">${photos.map((p, i) => `<div class="th"><img src="${esc(p.image_url)}" loading="lazy" alt="Storefront photo ${i + 1}. Tap to enlarge" role="button" tabindex="0" data-a="zoomph|${i}" class="zoomable">${own ? `<button class="x" data-a="gdel|${p.id}" aria-label="Remove photo">&times;</button>` : ''}</div>`).join('')}</div>${photos.length ? '' : '<p class="muted sm" style="margin:0">No storefront photos yet.</p>'}${own ? `<div style="margin-top:12px">${btn('gold-o', 'Add photos', 'gadd')}</div>` : ''}`);
  h += sec('Products and services', `<div class="cprev">${prods.slice(0, 4).map(p => `<button class="ctile" data-a="catalog|${id}|${p.id}" aria-label="Open ${esc(p.product_name)} in the catalog">${p.media_url ? `<img src="${esc(p.media_url)}" loading="lazy" alt="">` : `<span class="cph">${esc(p.product_name[0])}</span>`}<span class="cn">${esc(p.product_name)}</span><span class="cp">${priceTxt(p.price_kina)}</span>${stockBadge(p.is_in_stock)}</button>`).join('')}</div>${prods.length ? '' : '<p class="muted sm" style="margin:0 0 12px">No products yet.</p>'}<button class="btn gold-o full" data-a="catalog|${id}">${own ? 'Open my catalog' : 'Open catalog'} (${prods.length})</button>`);
  h += sec('About and contact', own ? `<textarea id="pbio" class="in" rows="3" maxlength="600" placeholder="About your business">${esc(u.bio)}</textarea>${phoneField('pwa', 'WhatsApp number', 'Customers reach you here when they tap Arrange on WhatsApp.', u.whatsapp_number)}${phoneField('pph', 'Phone number (optional)', 'For people who prefer to call.', u.phone_number)}<input id="pgm" class="in" type="email" placeholder="Gmail" value="${esc(u.gmail)}">${btn('red', 'Save', 'savep')}`
    : `<p class="muted sm" style="margin:0;line-height:1.6">${esc(u.bio) || 'No description yet.'}</p><div style="margin-top:12px;display:grid;gap:8px" class="sm">${u.whatsapp_number ? `<a class="gold" target="_blank" rel="noopener" href="${esc(waLink(u.whatsapp_number, 'Hi'))}">WhatsApp: ${esc(fmtPhone(u.whatsapp_number))}</a>` : ''}${u.phone_number ? `<a class="gold" href="tel:${esc(u.phone_number)}">Phone: ${esc(fmtPhone(u.phone_number))}</a>` : ''}${u.gmail ? `<a class="gold" href="mailto:${esc(u.gmail)}">Gmail: ${esc(u.gmail)}</a>` : ''}</div>`);
  app.innerHTML = h;
}
const val = id => ($(id)?.value || '').trim(), redo = () => renderProfile(S.view.id);
// Phone numbers are saved as country code + number (for example +67572345678), chosen with a list instead of typed by hand.
const CODES = [['+675', 'Papua New Guinea'], ['+61', 'Australia'], ['+64', 'New Zealand'], ['+679', 'Fiji'], ['+677', 'Solomon Islands'], ['+678', 'Vanuatu'], ['+65', 'Singapore'], ['+63', 'Philippines'], ['+62', 'Indonesia'], ['+44', 'United Kingdom'], ['+1', 'USA / Canada']];
const splitPhone = v => {
  const s = String(v || '').trim(); if (!s) return { code: '+675', num: '' };
  const c = s[0] === '+' ? [...CODES].sort((a, b) => b[0].length - a[0].length).find(x => s.startsWith(x[0])) : null;
  return c ? { code: c[0], num: s.slice(c[0].length).replace(/\D/g, '') } : { code: '+675', num: s.replace(/\D/g, '') };
};
const fmtPhone = v => { if (!v) return ''; const { code, num } = splitPhone(v); return code + ' ' + num.replace(/(\d{4})(?=\d)/g, '$1 '); };
const phoneField = (id, label, hint, v) => { const { code, num } = splitPhone(v); return `<label class="sm" style="display:block;margin-bottom:8px">${label}<span class="tiny muted" style="display:block;margin:2px 0 6px">${hint}</span><span class="row" style="flex-wrap:nowrap"><select id="${id}c" class="in" style="width:auto;flex:none;max-width:48%;margin:0" aria-label="${label}: country code">${CODES.map(c => `<option value="${c[0]}" ${c[0] === code ? 'selected' : ''}>${c[0]} ${c[1]}</option>`).join('')}</select><input id="${id}" class="in" style="margin:0" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="7234 5678" value="${esc(num)}"></span></label>`; };
const readPhone = (num, code) => {
  const raw = val(num); if (!raw) return null;
  if (/^(\+|00)/.test(raw)) throw new Error('Type only the number. Choose the country code from the list.');
  const d = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (d.length < 6 || d.length > 12) throw new Error('Enter the number without the country code, for example 7234 5678');
  return $(code).value + d;
};
const run = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Something went wrong'); } };

export const profileActions = {
  back: () => { location.hash = '#/'; },
  zoomph: i => openLightbox(cache.photos.map(p => p.image_url), +i),
  pic: () => run(async () => { const [f] = await pick('image/*'); if (!f) return; const r = await uploadOne('avatars', f, 256); const { error } = await sb.from('users').update({ profile_pic_url: r.url }).eq('id', S.user.id); if (error) throw error; S.user.profile_pic_url = r.url; redo(); }),
  savep: () => run(async () => {
    const row = {}; if ($('#pnm')) row.full_name = val('#pnm'); if ($('#pbio')) row.bio = val('#pbio') || null;
    if ($('#pwa')) Object.assign(row, { whatsapp_number: readPhone('#pwa', '#pwac'), phone_number: readPhone('#pph', '#pphc'), gmail: val('#pgm') || null });
    if (row.full_name !== undefined && row.full_name.length < 2) throw new Error('Enter a name');
    const { error } = await sb.from('users').update(row).eq('id', S.user.id); if (error) throw new Error(/check constraint/i.test(error.message) ? 'Check your phone number (use digits, e.g. +67572345678) and email' : error.message);
    Object.assign(S.user, row); toast('Saved'); redo();
  }),
  tobiz: () => run(async () => { if (!confirm('Switch to a business account? This cannot be undone.')) return; const { error } = await sb.rpc('become_business'); if (error) throw error; S.user.account_type = 'sme_owner'; S.myLocs = []; toast('Your account is now a business account. Add your location to start posting.'); redo(); }),
  verify: () => run(async () => { const { error } = await sb.from('users').update({ storefront_status: 'pending' }).eq('id', S.user.id); if (error) throw error; S.user.storefront_status = 'pending'; toast('Request sent. Add storefront photos so we can verify you.'); redo(); }),
  ladd: () => run(async () => { const { error } = await sb.from('business_locations').insert({ user_id: S.user.id, province_id: +$('#lp').value, city_hub_id: $('#lc').value ? +$('#lc').value : null }); if (error) throw new Error(/duplicate/i.test(error.message) ? 'You already added that location' : /foreign key/i.test(error.message) ? 'That city is not in that province' : error.message); redo(); }),
  ldel: id => run(async () => { if (!confirm('Removing a location also removes the posts made for it. Continue?')) return; const { error } = await sb.from('business_locations').delete().eq('id', id); if (error) throw error; redo(); }),
  gadd: () => run(async () => { const fs = await pick('image/*', true); for (const f of fs) { const r = await uploadOne('storefronts', f, 1024); const { error } = await sb.from('storefront_photos').insert({ user_id: S.user.id, image_url: r.url }); if (error) throw error; } redo(); }),
  gdel: id => run(async () => { const { error } = await sb.from('storefront_photos').delete().eq('id', id); if (error) throw error; redo(); }),
  // Flipping this updates sme_products; a database trigger notifies connected customers and Realtime refreshes every open feed.
};
profileActions.conn = id => toggleConn(id);
document.addEventListener('change', e => { if (e.target.id === 'lp') $('#lc').innerHTML = cityOpts(e.target.value); });
