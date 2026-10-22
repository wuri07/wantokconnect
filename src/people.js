import { sb } from './supabase.js';
import { S, $, esc, toast, avatar } from './ui.js';
import { vbadge } from './feed.js';

// Find People: search customers and businesses by name, connect, message and view profiles.
let tab = 'find', kind = '', term = '', list = [], timer;
const FIELDS = 'id,full_name,profile_pic_url,account_type,storefront_status,bio';

async function load() {
  const t = term.replace(/[%_\\]/g, ' ').trim(); let q = sb.from('users').select(FIELDS).neq('id', S.user.id).limit(40);
  if (tab === 'mine') { if (!S.conn.size) { list = []; return; } q = q.in('id', [...S.conn]).order('full_name'); }
  else q = q.eq('discoverable', true).order('created_at', { ascending: false });
  if (kind) q = q.eq('account_type', kind); if (t) q = q.ilike('full_name', `%${t}%`);
  const { data, error } = await q; if (error) toast(error.message); list = data || [];
}
export async function renderPeople() {
  const app = $('#app'); app.className = 'wrap narrow';
  app.innerHTML = `<div class="chead"><h1>Find People</h1><p class="sub" style="margin:4px 0 0;font-size:13px">Search for customers and businesses, connect, message and share listings.</p></div>
   <div class="pad" style="padding-top:0"><div class="tabs"><button data-a="ptab|find" class="${tab === 'find' ? 'on' : ''}">Discover</button><button data-a="ptab|mine" class="${tab === 'mine' ? 'on' : ''}">My connections (${S.conn.size})</button></div>
   <input id="pq" class="in" type="search" style="margin:12px 0 8px;border-radius:999px;padding:10px 14px" placeholder="Search by name" aria-label="Search people" maxlength="60" value="${esc(term)}">
   <div class="row">${[['', 'Everyone'], ['customer', 'Customers'], ['sme_owner', 'Businesses']].map(k => `<button class="chip ${kind === k[0] ? 'on' : ''}" data-a="pkind|${k[0]}">${k[1]}</button>`).join('')}</div></div><div id="plist"><p class="pad muted">Loading...</p></div>`;
  await load(); drawPeople();
}
export function drawPeople() {
  const el = $('#plist'); if (!el) return;
  el.innerHTML = list.map(u => { const cn = S.conn.has(u.id);
    return `<article class="pcard" style="align-items:flex-start"><button data-a="prof|${u.id}" aria-label="Open ${esc(u.full_name)}">${avatar(u.profile_pic_url, u.full_name)}</button><div class="grow"><button class="b" data-a="prof|${u.id}">${esc(u.full_name)}</button>${u.storefront_status === 'verified' ? vbadge : ''}<div class="sub">${u.account_type === 'sme_owner' ? 'Business' : 'Customer'}</div>${u.bio ? `<p class="muted sm" style="margin:6px 0 0">${esc(u.bio.slice(0, 120))}</p>` : ''}
     <div class="row" style="margin-top:10px"><button class="chip ${cn ? 'tag' : ''}" style="${cn ? '' : 'border-color:var(--primary);color:var(--primary)'}" data-a="conn|${u.id}">${cn ? 'Connected' : 'Connect'}</button><button class="chip" data-a="msg|${u.id}">Message</button><button class="chip" data-a="prof|${u.id}">View profile</button></div></div></article>`; }).join('')
    || `<p class="pad muted">${tab === 'mine' ? 'You have not connected with anyone yet. Use Discover to find people.' : 'No one found. Try a different name.'}</p>`;
}
document.addEventListener('input', e => { if (e.target.id === 'pq' && S.view.t === 'people') { clearTimeout(timer); timer = setTimeout(async () => { term = e.target.value; await load(); drawPeople(); }, 300); } });
export const peopleActions = { ptab: async b => { tab = b; await renderPeople(); }, pkind: async b => { kind = b; await renderPeople(); } };
