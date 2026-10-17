import { sb } from './supabase.js';
import { S, $, esc, kb, ago, toast, waLink, avatar, pick, uploadMedia, openSheet, closeSheet, locLabel } from './ui.js';

const PAGE = 20, MAXM = 10;
export const vbadge = '<span class="vb">Physical Storefront Verified</span>';
export const stockBadge = i => i ? '<span class="st yes">In Stock</span>' : '<span class="st out">Out of Stock</span>';
export const priceTxt = p => Number(p) > 0 ? 'K' + Number(p).toFixed(2) : 'Ask for price';
const catOpts = () => S.ref.cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const locOpts = sel => S.myLocs.map(l => `<option value="${l.id}" ${l.id == sel ? 'selected' : ''}>${esc(locLabel(l))}</option>`).join('');

/* ---------- composer: business owners only. Posting also creates the catalog entry. ---------- */
export function composer() {
  if (S.user.account_type !== 'sme_owner') return '<p class="note">Browse listings, connect with businesses and arrange on WhatsApp. Only business owners can post.</p>';
  if (!S.myLocs.length) return `<div class="note gold-box"><b class="gold">Add your business location first</b><p>Buyers filter by location. Add one in your profile, then post here.</p><button class="btn gold-o" data-a="prof|${S.user.id}">Open my profile</button></div>`;
  return `<div class="comp">${avatar(S.user.profile_pic_url, S.user.full_name)}<div class="grow">
   <input id="cnm" class="in" maxlength="150" placeholder="What are you selling or offering?">
   <div class="grid2"><select id="ccat" class="in" aria-label="Category">${catOpts()}</select><input id="cpp" class="in" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Price in K (optional)"></div>
   <select id="clc" class="in" aria-label="Location available">${locOpts()}</select>
   <textarea id="ctx" class="in" rows="3" maxlength="1500" placeholder="Describe your product or offer"></textarea><div id="cmd"></div>
   <div class="between"><div class="row"><button class="btn line-o" data-a="cph|cp">Photos</button><button class="btn line-o" data-a="cfl|cp">Files</button></div><button class="btn red" id="cpost" data-a="post">Post</button></div>
   <p class="err" id="cer"></p><p class="tiny muted">Your post is added to your catalog automatically.</p></div></div>`;
}
export function drawMedia(k) {
  const el = $(k === 'cp' ? '#cmd' : '#smd'); if (!el) return;
  const L = S[k].m;
  el.innerHTML = L.length ? `<div class="thumbs">${L.map((x, i) => `<div class="th">${x.img ? `<img src="${x.url}" alt="">` : `<div class="file" style="height:96px;flex-direction:column;align-items:flex-start"><i>FILE</i><span style="white-space:normal;word-break:break-all;font-size:11px">${esc(x.file.name)}</span><span class="muted tiny">${kb(x.file.size)}</span></div>`}<button class="x" data-a="crm|${k}|${i}" aria-label="Remove attachment">&times;</button></div>`).join('')}</div><p class="tiny muted">${L.length} attached (up to ${MAXM})</p>` : '';
}
async function addFiles(k, images) {
  for (const f of await pick(images ? 'image/*' : '', true)) {
    if (S[k].m.length >= MAXM) { toast(`Up to ${MAXM} attachments per post`); break; }
    if (f.size > 10485760) { toast(f.name + ' is over 10 MB'); continue; }
    const img = f.type.startsWith('image/'); S[k].m.push({ file: f, img, url: img ? URL.createObjectURL(f) : '' });
  }
  drawMedia(k);
}

/* ---------- feed ---------- */
export async function loadFeed(reset = true) {
  const f = S.f; let q = sb.from('feed_posts').select('*').order('created_at', { ascending: false });
  if (f.reg) q = q.eq('region_id', f.reg); if (f.prov) q = q.eq('province_id', f.prov); if (f.cat) q = q.eq('category_id', f.cat);
  const term = S.q.replace(/[,()%*\\:"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);   // plain-text search across business, product, description, category and place
  if (term) q = q.or(['author_name', 'product_name', 'content', 'category_name', 'location_label'].map(c => `${c}.ilike."*${term}*"`).join(','));
  const from = reset ? 0 : S.posts.length, { data, error } = await q.range(from, from + PAGE - 1);
  if (error) return toast(error.message);
  S.posts = reset ? data : [...S.posts, ...data]; S.more = data.length === PAGE; drawList();
}
export function renderFeedView() { $('#app').innerHTML = `<div id="cmp">${composer()}</div><div id="cnt"></div><div id="list"></div>`; drawMedia('cp'); drawList(); }
export function drawList() {
  const l = $('#list'); if (!l) return; const f = S.f, any = f.reg || f.prov || f.cat || S.q;
  $('#cnt').innerHTML = `<div class="count"><span>${S.posts.length}${S.more ? '+' : ''} listing${S.posts.length === 1 ? '' : 's'}${S.q ? ' for "' + esc(S.q) + '"' : ''}</span>${any ? '<button data-a="fclear">Clear filters</button>' : ''}</div>`;
  l.innerHTML = (S.posts.map(card).join('') || '<p class="pad muted">No listings match. Try different words or clear the filters.</p>') + (S.more ? '<div class="pad"><button class="btn line-o full" data-a="more">Load more</button></div>' : '');
}
function card(p) {
  const mine = p.user_id === S.user.id, cn = S.conn.has(p.user_id), M = p.media || [], im = M.filter(x => x.kind === 'image'), fl = M.filter(x => x.kind !== 'image');
  const wa = waLink(p.author_whatsapp, `Hi, I saw ${p.product_name || 'your post'} on WantokConnect.`);
  return `<article class="post" data-pid="${p.id}"><button data-a="prof|${p.user_id}" aria-label="Open ${esc(p.author_name)}">${avatar(p.author_pic, p.author_name)}</button><div class="grow">
   <div class="between" style="margin:0;align-items:flex-start"><div class="grow"><button class="b" data-a="prof|${p.user_id}">${esc(p.author_name)}</button>${p.author_verified ? vbadge : ''}<div class="sub">${esc(p.location_label)}</div></div>
   ${mine ? `<button class="chip" style="border-color:var(--red);color:var(--red)" data-a="dpost|${p.id}" aria-label="Delete this post">Delete</button>` : `<button class="chip ${cn ? 'tag' : ''}" style="${cn ? '' : 'border-color:var(--red);color:var(--red)'}" data-a="conn|${p.user_id}">${cn ? 'Connected' : 'Connect'}</button>`}</div>
   ${im.length ? `<div class="media ${im.length > 1 ? 'm2' : ''}">${im.map((x, i) => `<img src="${esc(x.url)}" loading="lazy" alt="" class="${im.length > 2 && im.length % 2 && i === 0 ? 'span' : ''}">`).join('')}</div>` : ''}
   ${fl.map(x => `<a class="file" href="${esc(x.url)}" target="_blank" rel="noopener"><i>FILE</i><span>${esc(x.name)}</span><span class="muted tiny" style="flex:none">${kb(x.size)}</span></a>`).join('')}
   <p style="white-space:pre-wrap;word-break:break-word;margin:12px 0 0">${esc(p.content)}</p>
   ${p.product_name ? `<div class="prod"><div class="grow"><div class="b sm">${esc(p.product_name)}</div><div class="sub">${priceTxt(p.price_kina)} &middot; ${esc(p.category_name || '')}</div></div>${stockBadge(p.is_in_stock)}</div>` : ''}
   ${mine ? '' : `<div class="row" style="margin-top:12px">${wa ? `<a class="btn red" style="flex:1" href="${esc(wa)}" target="_blank" rel="noopener">Arrange on WhatsApp</a>` : '<span class="tiny muted" style="flex:1">This business has not added a WhatsApp number yet.</span>'}<button class="btn gold-o" data-a="msg|${p.user_id}">Message</button></div>`}
   <div class="tiny muted" style="margin-top:8px">${ago(p.created_at)} ago</div></div></article>`;
}
// Deep link: scroll to a post and highlight it, fetching it if it is not on the first page.
export async function focusPost(id) {
  S.f = { reg: '', prov: '', cat: '' }; S.q = ''; await loadFeed(true);
  if (!S.posts.some(p => p.id == id)) { const { data } = await sb.from('feed_posts').select('*').eq('id', id).maybeSingle(); if (data) { S.posts.unshift(data); drawList(); } else toast('That post is no longer available'); }
  const a = document.querySelector(`[data-pid="${id}"]`); if (a) { a.scrollIntoView({ block: 'center' }); a.classList.add('hl'); setTimeout(() => a.classList.remove('hl'), 2500); }
}
// Live stock sync: called from the Realtime subscription on sme_products.
export function stockUpdate(row) { let hit = false; S.posts.forEach(p => { if (p.product_id === row.id) { p.is_in_stock = row.is_in_stock; hit = true; } }); if (hit || S.view.t === 'profile') S.refresh(); }

export async function toggleConn(id) {
  const me = S.user.id;
  const { error } = S.conn.has(id) ? await sb.from('user_connections').delete().eq('follower_id', me).eq('following_id', id) : await sb.from('user_connections').insert({ follower_id: me, following_id: id });
  if (error) return toast(error.message);
  S.conn.has(id) ? S.conn.delete(id) : S.conn.add(id); S.refresh();
}
// Post an existing catalog item (from the profile catalog).
export function openPostSheet(pr) {
  S.pp = { m: [] }; const i = S.myLocs.find(l => l.id === pr.location_id)?.id;
  openSheet(`<div class="between" style="margin:0 0 16px"><b style="font-size:18px">Post: ${esc(pr.product_name)}</b><button data-a="sclose" style="font-size:26px;width:40px;height:40px;text-align:center" aria-label="Close">&times;</button></div>
   <select id="slc" class="in" aria-label="Location">${locOpts(i)}</select><textarea id="stx" class="in" rows="3" placeholder="Describe this offer">${esc(pr.description)}</textarea><div id="smd"></div>
   <div class="row" style="margin-top:8px"><button class="btn gold-o" data-a="cph|pp">Photos</button><button class="btn gold-o" data-a="cfl|pp">Files</button><button class="btn red" style="margin-left:auto" id="spost" data-a="ppsend|${pr.id}">Post</button></div><p class="err" id="ser"></p>`);
}

export const feedActions = {
  more: () => loadFeed(false),
  // Delete one of your own posts. The item stays in your catalog so you can post it again later.
  dpost: async id => {
    if (!confirm('Delete this post? The item stays in your catalog.')) return;
    const { error } = await sb.from('marketplace_posts').delete().eq('id', id); if (error) return toast(error.message);
    S.posts = S.posts.filter(p => p.id != id); drawList(); toast('Post deleted');
  },
  cph: k => addFiles(k, true), cfl: k => addFiles(k, false), crm: (k, i) => { S[k].m.splice(+i, 1); drawMedia(k); },
  conn: id => toggleConn(id), sclose: closeSheet,
  post: async () => {
    const er = $('#cer'), btn = $('#cpost'), name = $('#cnm').value.trim(), text = $('#ctx').value.trim(), price = parseFloat($('#cpp').value);
    if (!name) return er.textContent = 'Enter the product or service name.'; if (text.length < 5) return er.textContent = 'Write a short description.';
    btn.disabled = true; btn.textContent = 'Posting...'; er.textContent = '';
    try {
      const media = await uploadMedia(S.cp.m.map(x => x.file));
      const { error } = await sb.rpc('post_new_item', { p_name: name, p_category: +$('#ccat').value, p_price: price >= 0 ? price : 0, p_location: +$('#clc').value, p_content: text, p_media: media.map(({ path, ...m }) => m) });
      if (error) throw error;
      S.cp = { m: [] }; await loadFeed(true); renderFeedView(); toast('Posted and added to your catalog');
    } catch (e) { er.textContent = e.message; btn.disabled = false; btn.textContent = 'Post'; }
  },
  ppsend: async id => {
    const er = $('#ser'), btn = $('#spost'), text = $('#stx').value.trim();
    if (text.length < 5) return er.textContent = 'Write a short description.';
    btn.disabled = true; btn.textContent = 'Posting...';
    try {
      const media = await uploadMedia(S.pp.m.map(x => x.file));
      const { data, error } = await sb.rpc('post_existing_item', { p_product: +id, p_location: +$('#slc').value, p_content: text, p_media: media.map(({ path, ...m }) => m) });
      if (error) throw error;
      closeSheet(); location.hash = '#/post/' + data;
    } catch (e) { er.textContent = e.message; btn.disabled = false; btn.textContent = 'Post'; }
  },
};
