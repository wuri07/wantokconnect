import { sb } from './supabase.js';
import { S, $, esc, ago, toast, avatar, openSheet, closeSheet } from './ui.js';
import { api, isNet } from './api.js';
import { enqueue, cacheGet, cacheSet } from './offline.js';

const TYPES = [['job_opening', 'Job Opening'], ['offer_service', 'Service Offer'], ['industry_question', 'Industry Query'], ['company_news', 'Company News'], ['achievement', 'Achievement']];
const tn = k => TYPES.find(x => x[0] === k)?.[1] || k;
let hubs = [], posts = [], nf = { hub: '', prov: '', type: '' }, fromCache = false, draft = '';
const opts = (list, sel, all) => `<option value="">${all}</option>` + list.map(x => `<option value="${x.id}" ${String(x.id) === String(sel) ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

async function load() {
  const qs = new URLSearchParams(); if (nf.hub) qs.set('hub', nf.hub); if (nf.prov) qs.set('province', nf.prov); if (nf.type) qs.set('type', nf.type);
  try { posts = (await api('/network/feed?' + qs)).data; fromCache = false; if (!qs.toString()) cacheSet('feed', posts); }
  catch (e) { if (isNet(e)) { posts = (await cacheGet('feed')) || []; fromCache = true; } else toast(e.message); }
}
export async function renderNetwork() {
  $('#app').innerHTML = '<p class="pad muted">Loading...</p>';
  if (!hubs.length) { hubs = (await cacheGet('hubs')) || []; try { const { data } = await sb.from('hubs').select('id,name').order('name'); if (data?.length) { hubs = data; cacheSet('hubs', data); } } catch { /* offline: cached hubs */ } }
  draft = (await cacheGet('draft')) || ''; await load(); draw();
}
function draw() {
  const keep = ['nty', 'nhb', 'ntx'].map(i => $('#' + i)?.value), app = $('#app');
  app.innerHTML = `<div class="between pad" style="margin:0"><h1 style="margin:0;font-size:20px">Professional Network</h1><button class="btn gold-o" data-a="nprof">My profile</button></div>
   <div class="comp"><div class="grow"><div class="grid2"><select id="nty" class="in" aria-label="Post type"><option value="">Post type</option>${TYPES.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select><select id="nhb" class="in" aria-label="Industry hub">${opts(hubs, '', 'Industry hub')}</select></div>
   <textarea id="ntx" class="in" rows="3" maxlength="1000" placeholder="Share something useful (jobs, services, questions, news, achievements)"></textarea>
   <div class="between" style="margin:0"><span class="tiny muted">Drafts save on this phone</span><button class="btn red" data-a="npost">Post</button></div><p class="err" id="ner"></p></div></div>
   <div class="grid3 pad" style="padding-bottom:0"><select class="in" data-nf="hub" aria-label="Filter by hub">${opts(hubs, nf.hub, 'All hubs')}</select><select class="in" data-nf="prov" aria-label="Filter by province">${opts(S.ref.provinces, nf.prov, 'All provinces')}</select><select class="in" data-nf="type" aria-label="Filter by type"><option value="">All types</option>${TYPES.map(t => `<option value="${t[0]}" ${nf.type === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>
   ${fromCache ? '<p class="note">Showing the last saved feed. Connect to see new posts.</p>' : ''}${posts.map(card).join('') || '<p class="pad muted">No posts yet. Be the first to share.</p>'}`;
  ['nty', 'nhb', 'ntx'].forEach((i, j) => { const v = keep[j] ?? (i === 'ntx' ? draft : undefined); if (v != null) $('#' + i).value = v; });
}
function card(p) {
  const mine = p.user_id === S.user.id, cn = S.conn.has(p.user_id);
  return `<article class="post">${avatar(p.profile_pic_url, p.full_name)}<div class="grow"><div class="between" style="margin:0;align-items:flex-start"><div class="grow"><b>${esc(p.full_name)}</b>${p.id_verified ? '<span class="vb">ID Verified</span>' : ''}<div class="sub">${esc(p.headline || '')}</div></div>
   ${mine ? '' : `<button class="chip ${cn ? 'tag' : ''}" data-a="nconn|${p.user_id}">${cn ? 'Connected' : 'Connect'}</button>`}</div>
   <div class="row" style="margin-top:8px"><span class="chip tag">${tn(p.post_type)}</span><span class="tiny muted">${esc(p.hub_name || '')}${p.province_name ? ' &middot; ' + esc(p.province_name) : ''}</span></div>
   <p style="white-space:pre-wrap;word-break:break-word;margin:12px 0 0">${esc(p.content)}</p>
   <div class="row" style="margin-top:12px"><button class="chip ${p.i_vouched ? 'tag' : ''}" style="${p.i_vouched ? 'box-shadow:0 0 10px rgba(255,215,0,.35)' : ''}" data-a="nreact|${p.id}|v" aria-pressed="${p.i_vouched}">Vouched ${p.vouched_count}</button>
   <button class="chip ${p.i_resourceful ? 'on' : ''}" data-a="nreact|${p.id}|r" aria-pressed="${p.i_resourceful}">Resourceful ${p.resourceful_count}</button>${mine ? '' : `<button class="chip" style="margin-left:auto" data-a="msg|${p.user_id}">Message</button>`}</div>
   <div class="tiny muted" style="margin-top:8px">${ago(p.created_at)} ago</div></div></article>`;
}
document.addEventListener('input', e => { if (e.target.id === 'ntx') cacheSet('draft', e.target.value); });
document.addEventListener('change', e => { const k = e.target.dataset?.nf; if (k && S.view.t === 'network') { nf[k] = e.target.value; load().then(draw); } });
window.addEventListener('wc-synced', () => { if (S.view.t === 'network') load().then(draw); });

async function openProfile() {
  let p = {}; try { p = await api('/network/profile/me'); } catch (e) { return toast(isNet(e) ? 'Connect to edit your profile' : e.message); }
  openSheet(`<div class="between" style="margin:0 0 16px"><b style="font-size:18px">My professional profile</b><button data-a="sclose" style="font-size:26px;width:40px;height:40px;text-align:center" aria-label="Close">&times;</button></div>
   <input id="phl" class="in" maxlength="150" placeholder="Headline, e.g. Diesel mechanic, 8 years" value="${esc(p.headline)}"><div class="grid2"><select id="phb" class="in" aria-label="Industry hub">${opts(hubs, p.hub_id, 'Industry hub')}</select><select id="ppv" class="in" aria-label="Province">${opts(S.ref.provinces, p.province_id, 'Province')}</select></div>
   <textarea id="pbi" class="in" rows="3" maxlength="1000" placeholder="About you">${esc(p.bio)}</textarea><input id="psk" class="in" placeholder="Skills, separated by commas" value="${esc((p.skills || []).join(', '))}">
   <button class="btn red full" data-a="nprofsave">Save profile</button><p class="err" id="pse"></p>`);
}
export const networkActions = {
  nprof: openProfile,
  nprofsave: async () => {
    const er = $('#pse'); try { await api('/network/profile/me', { method: 'PUT', body: { headline: $('#phl').value, hub_id: $('#phb').value, province_id: $('#ppv').value, bio: $('#pbi').value, skills: $('#psk').value.split(',') } }); closeSheet(); toast('Profile saved'); }
    catch (e) { er.textContent = e.message; }
  },
  npost: async () => {
    const er = $('#ner'), type = $('#nty').value, hub = $('#nhb').value, text = $('#ntx').value.trim();
    if (!type) return er.textContent = 'Choose a post type.'; if (!hub) return er.textContent = 'Choose an industry hub.'; if (text.length < 10) return er.textContent = 'Write at least 10 characters.';
    const id = crypto.randomUUID(), body = { type, hub_id: +hub, content: text };
    try { if (!navigator.onLine) throw new TypeError('offline'); await api('/network/posts', { method: 'POST', body: { ...body, client_uuid: id } }); toast('Posted'); }
    catch (e) { if (isNet(e)) { await enqueue('pro_post', body, id); toast('Saved. It will post when signal returns.'); } else return er.textContent = e.message; }
    cacheSet('draft', ''); draft = ''; ['ntx', 'nty', 'nhb'].forEach(i => { $('#' + i).value = ''; }); await load(); draw();
  },
  nreact: async (id, k) => {
    const p = posts.find(x => x.id == id); if (!p) return; const kind = k === 'v' ? 'vouched' : 'resourceful', f = k === 'v' ? 'i_vouched' : 'i_resourceful', c = k === 'v' ? 'vouched_count' : 'resourceful_count', on = !p[f];
    p[f] = on; p[c] += on ? 1 : -1; draw();
    try { if (!navigator.onLine) throw new TypeError('offline'); await api(`/network/posts/${id}/react`, { method: 'POST', body: { kind, on } }); }
    catch (e) { if (isNet(e)) await enqueue('react', { post_id: id, kind, on }); else { p[f] = !on; p[c] += on ? -1 : 1; draw(); toast(e.message); } }
  },
  nconn: async uid => {
    const on = !S.conn.has(uid); on ? S.conn.add(uid) : S.conn.delete(uid); draw();
    try { if (!navigator.onLine) throw new TypeError('offline'); await api('/network/connect/' + uid, { method: 'POST', body: { on } }); }
    catch (e) { if (isNet(e)) await enqueue('connect', { user_id: uid, on }); else { on ? S.conn.delete(uid) : S.conn.add(uid); draw(); toast(e.message); } }
  },
};
