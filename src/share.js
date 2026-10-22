import { sb } from './supabase.js';
import { S, $, esc, toast, avatar, openSheet } from './ui.js';
import { priceTxt } from './feed.js';

// Share a listing or catalog item: send it to another member in the app, or share the link on WhatsApp, Facebook, Instagram and more.
const base = () => location.origin;
function describe(kind, id) {
  if (kind === 'post') {
    const p = S.posts.find(x => x.id == id); if (!p) return null;
    return { title: `${p.product_name || 'A listing'} by ${p.author_name}`, text: `${p.product_name || 'Listing'} - ${priceTxt(p.price_kina)} (${p.location_label}) on WantokConnect`, link: `${base()}/p/${p.id}` };
  }
  const it = S.items.get(+id); if (!it) return null;
  return { title: `${it.product_name} by ${it.owner}`, text: `${it.product_name} - ${priceTxt(it.price_kina)} on WantokConnect`, link: `${base()}/i/${it.id}` };
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ } t.remove(); return ok; }
}
function sheet(d) {
  S.share = d; const enc = encodeURIComponent, full = `${d.text}\n${d.link}`, ic = (bg, t) => `<i style="background:${bg};font-size:${t.length > 2 ? 11 : 15}px">${t}</i>`;
  openSheet(`<div class="between" style="margin:0 0 4px"><b style="font-size:18px">Share</b><button data-a="sclose" style="font-size:26px;width:40px;height:40px;text-align:center" aria-label="Close">&times;</button></div><p class="sub" style="margin:0 0 4px">${esc(d.title)}</p>
   <div class="sgrid">
    <button class="sbtn" data-a="shu">${ic('var(--primary)', 'WC')}WantokConnect</button>
    <a class="sbtn" href="https://wa.me/?text=${enc(full)}" target="_blank" rel="noopener">${ic('#25D366', 'WA')}WhatsApp</a>
    <a class="sbtn" href="https://www.facebook.com/sharer/sharer.php?u=${enc(d.link)}" target="_blank" rel="noopener">${ic('#1877F2', 'f')}Facebook</a>
    <button class="sbtn" data-a="shig">${ic('linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)', 'IG')}Instagram</button>
    <button class="sbtn" data-a="shcp">${ic('var(--mute)', 'LINK')}Copy link</button>
    ${navigator.share ? `<button class="sbtn" data-a="shmore">${ic('var(--gold)', '...')}More apps</button>` : ''}
   </div><div id="shpick"></div>`);
}
async function loadPicker(term) {
  const el = $('#shl'); if (!el) return; term = term.replace(/[%_\\]/g, ' ').trim(); let rows = [];
  if (!term && S.conn.size) rows = (await sb.from('users').select('id,full_name,profile_pic_url').in('id', [...S.conn]).limit(30)).data || [];
  else { let q = sb.from('users').select('id,full_name,profile_pic_url').neq('id', S.user.id).eq('discoverable', true).order('created_at', { ascending: false }).limit(20); if (term) q = q.ilike('full_name', `%${term}%`); rows = (await q).data || []; }
  el.innerHTML = rows.map(u => `<div class="pcard" style="padding:10px 0">${avatar(u.profile_pic_url, u.full_name, 'sm')}<div class="grow sm b" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.full_name)}</div><button class="btn gold-o" style="padding:6px 14px" data-a="shsend|${u.id}">Send</button></div>`).join('') || '<p class="muted sm">No one found.</p>';
}
let timer;
document.addEventListener('input', e => { if (e.target.id === 'shq') { clearTimeout(timer); timer = setTimeout(() => loadPicker(e.target.value), 300); } });

export const shareActions = {
  share: (kind, id) => { const d = describe(kind, id); if (!d) return toast('Could not share that item'); sheet(d); },
  shu: () => { $('#shpick').innerHTML = `<div class="b sm" style="margin:8px 0">Send to a member</div><input id="shq" class="in" type="search" placeholder="Search by name" aria-label="Search members" maxlength="60"><div id="shl" style="max-height:240px;overflow:auto"></div>`; loadPicker(''); },
  shsend: async (uid, _c, btn) => {
    btn.disabled = true; const d = S.share;
    const { error } = await sb.from('direct_messages').insert({ sender_id: S.user.id, recipient_id: uid, body: `${d.text}\n${d.link}`.slice(0, 2000) });
    if (error) { btn.disabled = false; return toast(error.message); } btn.textContent = 'Sent';
  },
  // Instagram has no "share link" web address, so we copy the link and open Instagram messages to paste it.
  shig: () => { window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener'); copy(S.share.link); toast('Link copied. Paste it in an Instagram message, story link sticker or bio.'); },
  shcp: async () => { toast(await copy(S.share.link) ? 'Link copied' : 'Could not copy. Select and copy the link manually.'); },
  shmore: () => navigator.share({ title: S.share.title, text: S.share.text, url: S.share.link }).catch(() => {}),
};
