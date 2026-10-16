import { S, $, esc } from './ui.js';
import { loadFeed } from './feed.js';

let timer;
// Top of the marketplace: a normal search bar plus ONE Filter button. Opening Filter shows Region, Province (22) and Category.
export function drawFilter() {
  const box = $('#fb');
  if (S.view.t !== 'feed') { box.innerHTML = ''; return; }
  const { regions, provinces, cats } = S.ref, f = S.f, K = ['reg', 'prov', 'cat'], n = K.filter(k => f[k]).length;
  const all = { reg: 'All Regions', prov: 'All Provinces', cat: 'All Categories' };
  const name = { reg: id => regions.find(x => x.id == id)?.name, prov: id => provinces.find(x => x.id == id)?.name, cat: id => cats.find(x => x.id == id)?.name };
  const grp = (k, title, list) => `<div class="fgrp"><div>${title}</div><div class="row">${[{ id: '', name: all[k] }, ...list].map(x => `<button class="chip ${String(f[k]) === String(x.id) ? 'on' : ''}" data-a="fv|${k}|${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  const prov = f.reg ? provinces.filter(p => p.region_id == f.reg) : provinces;
  const chips = K.filter(k => f[k]).map(k => `<button class="chip tag" data-a="fv|${k}|" aria-label="Remove filter">${esc(name[k](f[k]))} &times;</button>`).join('');
  box.innerHTML = `<div class="filter"><input id="sq" class="in" type="search" style="margin:0;flex:1;min-width:0;border-radius:999px;padding:9px 14px" placeholder="Search products, services, businesses" aria-label="Search the marketplace" maxlength="60" autocomplete="off" value="${esc(S.q)}">
    <button class="fbtn ${n || S.fo ? 'on' : ''}" data-a="fopen" aria-expanded="${S.fo}" aria-controls="fp"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>Filter${n ? ` <span class="pill">${n}</span>` : ''}</button></div>
    ${chips ? `<div class="filter" style="padding-top:0">${chips}</div>` : ''}
    ${S.fo ? `<div id="fp" class="fpanel">${grp('reg', 'Region', regions)}${grp('prov', 'Province', prov)}${grp('cat', 'Category', cats)}<div class="fact"><button class="btn line-o" data-a="fclear">Clear all</button><button class="btn red" data-a="fopen">Show listings</button></div></div>` : ''}`;
}
// Typing updates only the list, so the search box keeps focus.
document.addEventListener('input', e => {
  if (e.target.id !== 'sq') return;
  clearTimeout(timer); timer = setTimeout(() => { S.q = e.target.value.trim(); loadFeed(true); }, 300);
});
export const filterActions = {
  fopen: () => { S.fo = !S.fo; drawFilter(); },
  fclear: () => { S.f = { reg: '', prov: '', cat: '' }; S.q = ''; drawFilter(); loadFeed(true); },
  fv: (k, v) => {
    const f = S.f; f[k] = v;
    if (k === 'reg' && f.prov && S.ref.provinces.find(p => p.id == f.prov)?.region_id != v) f.prov = '';
    if (k === 'prov' && v) f.reg = String(S.ref.provinces.find(p => p.id == v).region_id);
    drawFilter(); loadFeed(true);
  },
};
