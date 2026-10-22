import { sb } from './supabase.js';
import { S, $, esc, toast, pick, uploadOne, locLabel, waLink } from './ui.js';
import { stockBadge, priceTxt, openPostSheet } from './feed.js';
import { openLightbox } from './lightbox.js';

// The dedicated catalog page: every product and service a business offers. The profile page only shows a short preview.
let data = { u: null, items: [] }, adding = false, onlyStock = false, term = '', npImg = null, timer;
const catOpts = () => S.ref.cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
const run = async fn => { try { await fn(); } catch (e) { toast(e.message || 'Something went wrong'); } };
const redo = () => renderCatalog(S.view.id);

export async function renderCatalog(uid, focus) {
  const app = $('#app'); app.className = 'wrap'; app.innerHTML = '<p class="pad muted">Loading...</p>';
  const own = uid === S.user.id;
  const [{ data: u }, { data: items }] = await Promise.all([
    sb.from('users').select('id,full_name,profile_pic_url,whatsapp_number,phone_number,account_type').eq('id', uid).maybeSingle(),
    sb.from('sme_products').select('*,categories(name),business_locations(provinces(name),city_hubs(name))').eq('user_id', uid).order('created_at', { ascending: false })]);
  if (!u) { app.innerHTML = '<p class="pad muted">Business not found.</p>'; return; }
  if (own) { const { data: l } = await sb.from('business_locations').select('id,province_id,city_hub_id,provinces(name),city_hubs(name)').eq('user_id', uid); S.myLocs = l || []; }
  data = { u, items: items || [] }; S.items.clear(); data.items.forEach(i => S.items.set(i.id, { ...i, owner: u.full_name }));
  const n = data.items.length;
  app.innerHTML = `<button class="back" data-a="prof|${u.id}">&larr; Back to profile</button>
   <div class="chead"><div class="between" style="margin:0;align-items:flex-start"><div class="grow"><h1>Catalog</h1><div class="sub" style="font-size:13px">${esc(u.full_name)} &middot; ${n} item${n === 1 ? '' : 's'}</div></div>${own ? `<button class="btn red" data-a="cadd">${adding ? 'Close' : 'Add item'}</button>` : `<button class="btn gold-o" data-a="msg|${u.id}">Message</button>`}</div>
   <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input id="cq" class="in" type="search" style="margin:0;border-radius:999px;padding:9px 14px" placeholder="Search this catalog" aria-label="Search this catalog" value="${esc(term)}"><button class="chip ${onlyStock ? 'on' : ''}" data-a="cstock" style="flex:none">In stock</button></div></div>
   ${own && adding ? addForm() : ''}<div class="cgrid" id="cgrid"></div>`;
  drawGrid();
  if (focus) { const el = document.querySelector(`[data-iid="${focus}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 2500); } }
}
function addForm() {
  if (!S.myLocs.length) return `<section class="sec"><h2>Add a product or service</h2><p class="muted sm" style="margin:0 0 12px">Add your business location in your profile first, so buyers know where it is available.</p><button class="btn gold-o" data-a="prof|${S.user.id}">Open my profile</button></section>`;
  return `<section class="sec"><h2>Add a product or service</h2><input id="pn1" class="in" maxlength="150" placeholder="Name"><div class="grid2"><select id="pc1" class="in" aria-label="Category">${catOpts()}</select><input id="pp1" class="in" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Price in K (optional)"></div>
   <select id="pl1" class="in" aria-label="Location">${S.myLocs.map(l => `<option value="${l.id}">${esc(locLabel(l))}</option>`).join('')}</select><textarea id="pd1" class="in" rows="2" placeholder="Description"></textarea>
   <div class="row"><button class="btn gold-o" data-a="npph">Add photo</button><button class="btn red" data-a="padd">Add to catalog</button></div><p class="tiny muted" id="npv"></p><p class="err" id="per"></p></section>`;
}
function item(i, own) {
  const u = data.u, loc = i.business_locations ? locLabel(i.business_locations) : 'Ask the seller';
  const wa = own ? '' : waLink(u.whatsapp_number || u.phone_number, `Hi, I am interested in ${i.product_name} on WantokConnect.`);
  return `<article class="citem" data-iid="${i.id}">${i.media_url ? `<img class="cimg zoomable" src="${esc(i.media_url)}" loading="lazy" alt="${esc(i.product_name)}. Tap to enlarge" role="button" tabindex="0" data-a="zoomitem|${i.id}">` : `<div class="cph big">${esc(i.product_name[0])}</div>`}
   <div class="between" style="margin:0;align-items:flex-start"><div class="grow"><b>${esc(i.product_name)}</b><div class="sub">${priceTxt(i.price_kina)} &middot; ${esc(i.categories?.name || '')}</div></div>
   ${own ? `<button class="sw ${i.is_in_stock ? 'on' : ''}" data-a="stock|${i.id}" role="switch" aria-checked="${i.is_in_stock}" aria-label="In stock: ${esc(i.product_name)}"><span style="color:${i.is_in_stock ? 'var(--gold)' : 'var(--red)'}">${i.is_in_stock ? 'In Stock' : 'Out'}</span><i></i></button>` : stockBadge(i.is_in_stock)}</div>
   <p class="muted sm" style="margin:0">${esc(i.description)}</p><div class="tiny muted">Available: ${esc(loc)}</div>
   <div class="row" style="margin-top:auto;padding-top:4px">${own ? `<button class="btn gold-o" data-a="ppost|${i.id}">Post</button>` : wa ? `<a class="btn red" href="${esc(wa)}" target="_blank" rel="noopener">Arrange on WhatsApp</a>` : ''}
   <button class="btn line-o" data-a="share|item|${i.id}">Share</button>${own ? `<button class="tiny" style="color:var(--red);margin-left:auto" data-a="pdel|${i.id}">Remove</button>` : ''}</div></article>`;
}
function drawGrid() {
  const g = $('#cgrid'); if (!g) return; const own = data.u.id === S.user.id, t = term.toLowerCase();
  const list = data.items.filter(i => (!onlyStock || i.is_in_stock) && (!t || `${i.product_name} ${i.description} ${i.categories?.name || ''}`.toLowerCase().includes(t)));
  g.innerHTML = list.map(i => item(i, own)).join('') || '<p class="muted sm">No items match.</p>';
}
document.addEventListener('input', e => { if (e.target.id === 'cq' && S.view.t === 'catalog') { clearTimeout(timer); timer = setTimeout(() => { term = e.target.value.trim(); drawGrid(); }, 200); } });

export const catalogActions = {
  catalog: (uid, it) => { location.hash = '#/catalog/' + uid + (it ? '/' + it : ''); },
  cstock: () => { onlyStock = !onlyStock; redo(); },
  cadd: () => { adding = !adding; redo(); },
  zoomitem: id => { const i = data.items.find(x => x.id == id); if (i?.media_url) openLightbox([i.media_url], 0); },
  // Flipping this updates sme_products; a database trigger notifies connected customers and Realtime refreshes every open feed.
  stock: id => run(async () => { const i = data.items.find(x => x.id == id); const { error } = await sb.from('sme_products').update({ is_in_stock: !i.is_in_stock }).eq('id', id); if (error) throw error; redo(); }),
  pdel: id => run(async () => {
    if (!confirm('Remove this item from your catalog? Its posts in the feed will be removed too.')) return;
    await sb.from('marketplace_posts').delete().eq('product_id', id); const { error } = await sb.from('sme_products').delete().eq('id', id); if (error) throw error;
    S.posts = S.posts.filter(p => p.product_id != id); redo();
  }),
  npph: () => run(async () => { const [f] = await pick('image/*'); if (!f) return; npImg = f; $('#npv').textContent = 'Photo ready: ' + f.name; }),
  padd: () => run(async () => {
    const er = $('#per'), name = ($('#pn1').value || '').trim(), d = ($('#pd1').value || '').trim(), price = parseFloat($('#pp1').value);
    if (!name) return er.textContent = 'Enter a name.'; if (d.length < 5) return er.textContent = 'Add a short description.';
    const img = npImg ? await uploadOne('post-media', npImg, 1024) : null;
    const { error } = await sb.from('sme_products').insert({ user_id: S.user.id, product_name: name, description: d, category_id: +$('#pc1').value, price_kina: price >= 0 ? price : null, location_id: +$('#pl1').value, media_url: img?.url || null });
    if (error) throw error; npImg = null; adding = false; redo();
  }),
  ppost: id => { const i = data.items.find(x => x.id == id); if (i) openPostSheet(i); },
};
