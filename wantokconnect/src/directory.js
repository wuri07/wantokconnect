import { S, $, esc, toast, avatar, waLink } from './ui.js';
import { api, isNet } from './api.js';
import { cacheGet, cacheSet } from './offline.js';
import { vbadge } from './feed.js';

let df = { q: '', reg: '', prov: '', cat: '' }, list = [], fromCache = false, timer;
const opt = (arr, sel, all) => `<option value="">${all}</option>` + arr.map(x => `<option value="${x.id}" ${String(x.id) === String(sel) ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

async function load() {
  const qs = new URLSearchParams(); if (df.q) qs.set('q', df.q); if (df.reg) qs.set('region', df.reg); if (df.prov) qs.set('province', df.prov); if (df.cat) qs.set('category', df.cat);
  try { list = (await api('/directory?' + qs)).data; fromCache = false; if (!qs.toString()) cacheSet('directory', list); }
  catch (e) { if (isNet(e)) { list = (await cacheGet('directory')) || []; fromCache = true; } else toast(e.message); }
}
export async function renderDirectory() { $('#app').innerHTML = '<p class="pad muted">Loading...</p>'; await load(); draw(); }
function draw() {
  const { regions, provinces, cats } = S.ref, provs = df.reg ? provinces.filter(p => p.region_id == df.reg) : provinces, hadFocus = document.activeElement?.id === 'dq';
  $('#app').innerHTML = `<div class="pad" style="padding-bottom:0"><h1 style="margin:0 0 12px;font-size:20px">Business Directory</h1><input id="dq" class="in" type="search" placeholder="Search by business name" value="${esc(df.q)}" aria-label="Search businesses">
   <div class="grid3"><select class="in" data-df="reg" aria-label="Region">${opt(regions, df.reg, 'All Regions')}</select><select class="in" data-df="prov" aria-label="Province">${opt(provs, df.prov, 'All Provinces')}</select><select class="in" data-df="cat" aria-label="Category">${opt(cats, df.cat, 'All Categories')}</select></div></div>
   ${fromCache ? '<p class="note">Showing the last saved list. Connect to refresh.</p>' : ''}<div class="count"><span>${list.length}${list.length === 20 ? '+' : ''} business${list.length === 1 ? '' : 'es'}</span></div>
   ${list.map(b => { const wa = waLink(b.whatsapp, 'Hi, I found you in the WantokConnect directory.'), cats = (b.categories || []).slice(0, 3), locs = [...new Set((b.locations || []).map(l => [l.city, l.province].filter(Boolean).join(', ')))].slice(0, 3);
     return `<article class="post"><button data-a="prof|${b.id}" aria-label="Open ${esc(b.full_name)}">${avatar(b.profile_pic_url, b.full_name)}</button><div class="grow"><button class="b" data-a="prof|${b.id}">${esc(b.full_name)}</button>${b.verified ? vbadge : ''}
      <div class="sub">${esc(locs.join(' | ') || 'No location added yet')}</div>${cats.length ? `<div class="row" style="margin-top:8px">${cats.map(c => `<span class="chip tag">${esc(c)}</span>`).join('')}</div>` : ''}
      ${b.bio ? `<p class="muted sm" style="margin:8px 0 0">${esc(b.bio)}</p>` : ''}<div class="row" style="margin-top:12px"><button class="btn gold-o" data-a="prof|${b.id}">View profile</button>${wa ? `<a class="btn red" href="${esc(wa)}" target="_blank" rel="noopener">Arrange on WhatsApp</a>` : ''}</div></div></article>`; }).join('') || '<p class="pad muted">No businesses match. Try All Regions or All Categories.</p>'}`;
  if (hadFocus) { const i = $('#dq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
document.addEventListener('input', e => { if (e.target.id === 'dq' && S.view.t === 'directory') { df.q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(() => load().then(draw), 350); } });
document.addEventListener('change', e => {
  const k = e.target.dataset?.df; if (!k || S.view.t !== 'directory') return; df[k] = e.target.value;
  if (k === 'reg' && df.prov && S.ref.provinces.find(p => p.id == df.prov)?.region_id != df.reg) df.prov = '';
  if (k === 'prov' && df.prov) df.reg = String(S.ref.provinces.find(p => p.id == df.prov).region_id);
  load().then(draw);
});
export const directoryActions = {};
