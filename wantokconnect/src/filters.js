import { S, $, esc } from './ui.js';
import { loadFeed } from './feed.js';

// One "Filter" button. Opening it shows all three groups: Region, Province (22) and Category.
export function drawFilter() {
  const box = $('#fb');
  if (S.view.t !== 'feed') { box.innerHTML = ''; return; }
  const { regions, provinces, cats } = S.ref, f = S.f, K = ['reg', 'prov', 'cat'], n = K.filter(k => f[k]).length;
  const all = { reg: 'All Regions', prov: 'All Provinces', cat: 'All Categories' };
  const name = { reg: id => regions.find(x => x.id == id)?.name, prov: id => provinces.find(x => x.id == id)?.name, cat: id => cats.find(x => x.id == id)?.name };
  const grp = (k, title, list) => `<div class="fgrp"><div>${title}</div><div class="row">${[{ id: '', name: all[k] }, ...list].map(x => `<button class="chip ${String(f[k]) === String(x.id) ? 'on' : ''}" data-a="fv|${k}|${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  const prov = f.reg ? provinces.filter(p => p.region_id == f.reg) : provinces;
  box.innerHTML = `<div class="filter"><button class="fbtn ${n || S.fo ? 'on' : ''}" data-a="fopen" aria-expanded="${S.fo}" aria-controls="fp"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>Filter${n ? ` <span class="pill">${n}</span>` : ''}</button>
    ${K.filter(k => f[k]).map(k => `<button class="chip tag" data-a="fv|${k}|" aria-label="Remove filter">${esc(name[k](f[k]))} &times;</button>`).join('')}</div>
    ${S.fo ? `<div id="fp" class="fpanel">${grp('reg', 'Region', regions)}${grp('prov', 'Province', prov)}${grp('cat', 'Category', cats)}<div class="fact"><button class="btn line-o" data-a="fclear">Clear all</button><button class="btn red" data-a="fopen">Show listings</button></div></div>` : ''}`;
}
export const filterActions = {
  fopen: () => { S.fo = !S.fo; drawFilter(); },
  fclear: () => { S.f = { reg: '', prov: '', cat: '' }; drawFilter(); loadFeed(true); },
  fv: (k, v) => {
    const f = S.f; f[k] = v;
    if (k === 'reg' && f.prov && S.ref.provinces.find(p => p.id == f.prov)?.region_id != v) f.prov = '';
    if (k === 'prov' && v) f.reg = String(S.ref.provinces.find(p => p.id == v).region_id);
    drawFilter(); loadFeed(true);
  },
};
