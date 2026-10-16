import { sb } from './supabase.js';
import { S, $, esc, ago, toast, avatar, openSheet, closeSheet, waLink } from './ui.js';

export const badges = () => { const b = $('#bc'); b.textContent = S.unreadN; b.hidden = !S.unreadN; $('#mb').classList.toggle('glow', S.unreadM > 0); };
export async function refreshCounts() {
  const me = S.user.id, [n, m] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', me).eq('is_read', false),
    sb.from('direct_messages').select('id', { count: 'exact', head: true }).eq('recipient_id', me).is('read_at', null)]);
  S.unreadN = n.count || 0; S.unreadM = m.count || 0; badges();
}
const pill = n => n ? `<span class="pill">${n}</span>` : '';
const row = (a, t, r = '', c = '') => `<button class="dr ${c}" data-a="${a}"><span>${t}</span><span class="muted sm">${r}</span></button>`;
const go = h => { closeDrawer(); if (location.hash === h) window.dispatchEvent(new Event('hashchange')); else location.hash = h; };
export const closeDrawer = () => { $('#dr').hidden = true; };

async function loadNotifs() { const { data } = await sb.from('notifications').select('id,post_id,actor_id,message,is_read,created_at').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(50); S.notifs = data || []; }
async function loadThreads() {
  const me = S.user.id, { data } = await sb.from('direct_messages').select('sender_id,recipient_id,body,read_at,created_at').or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(300);
  const t = new Map(); (data || []).forEach(m => { const peer = m.sender_id === me ? m.recipient_id : m.sender_id; if (!t.has(peer)) t.set(peer, { peer, last: m, unread: 0 }); if (m.recipient_id === me && !m.read_at) t.get(peer).unread++; });
  const ids = [...t.keys()], who = {}; if (ids.length) { const { data: us } = await sb.from('users').select('id,full_name,profile_pic_url').in('id', ids); (us || []).forEach(u => who[u.id] = u); }
  S.threads = [...t.values()].map(x => ({ ...x, user: who[x.peer] || { full_name: 'Member' } }));
}
const fbCap = () => ['exp', 'imp'].forEach(k => { const e = $('#' + k); if (e) S.fb[k] = e.value; });
function fbHtml() {
  const sme = S.user.account_type === 'sme_owner', F = S.fb;
  if (F.done) return '<h2 class="dt">Thank you</h2><p class="muted sm">Your feedback helps us improve WantokConnect for everyone.</p><button class="btn gold-o" data-a="fbnew">Send more feedback</button>';
  const ta = (id, label, ph) => `<label class="sm" style="display:block;margin-bottom:16px">${label}<textarea id="${id}" class="in" rows="3" maxlength="2000" style="margin-top:8px" placeholder="${ph}">${esc(F[id])}</textarea></label>`;
  return `<h2 class="dt">Feedback Center</h2>${sme ? `<div class="sm" style="margin-bottom:16px">Have you made sales through WantokConnect?<div class="row" style="margin-top:8px">${[['yes', 'Yes'], ['no', 'Not yet']].map(o => `<button class="chip ${F.sales === o[0] ? 'on' : ''}" style="flex:1;text-align:center" data-a="fbs|${o[0]}" aria-pressed="${F.sales === o[0]}">${o[1]}</button>`).join('')}</div></div>`
    : `<div class="sm" style="margin-bottom:16px">Rate your experience<div class="row stars" style="margin-top:8px">${[1, 2, 3, 4, 5].map(i => `<button class="${F.rate >= i ? 'on' : ''}" data-a="fbr|${i}" aria-label="${i} star">&#9733;</button>`).join('')}</div></div>`}
    ${ta('exp', sme ? 'Your business experience' : 'Your shopping experience', sme ? 'How is business going on the platform?' : 'What was it like to find and arrange a purchase?')}${ta('imp', 'What should we improve?', 'Tell us what would help')}<p class="err" id="fer"></p><button class="btn red full" data-a="fbsend">Send feedback</button>`;
}
export function drawDrawer() {
  const home = S.dv === 'home'; let b = '';
  if (home) b = `<div class="row" style="gap:12px;flex-wrap:nowrap;margin-bottom:24px">${avatar(S.user.profile_pic_url, S.user.full_name, 'sm')}<div class="grow"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(S.user.full_name)}</b><span class="sub">${S.user.account_type === 'sme_owner' ? 'Business owner' : 'Customer'}</span></div></div>
    ${row('home', 'General Feed / Marketplace')}${row('nav|#/directory', 'Search Business')}${row('nav|#/network', 'Professional Network')}${row('nav|#/verify', 'Verification')}${row('prof|' + S.user.id, 'Your Profile')}${row('dv|notif', 'Notifications', pill(S.unreadN))}${row('dv|msg', 'Inboxes / Messages', pill(S.unreadM))}${row('dv|fb', 'Feedback Center')}${row('logout', 'Log out', '', 'red-t')}`;
  else if (S.dv === 'notif') b = `<div class="between" style="margin:0 0 20px"><h2 class="dt" style="margin:0">Notifications</h2><button class="gold sm" data-a="readall" style="padding:8px">Mark all read</button></div>`
    + (S.notifs.map(n => `<button class="nrow" data-a="nopen|${n.id}"><span class="dot ${n.is_read ? '' : 'u'}"></span><span class="grow"><span class="sm" style="display:block">${esc(n.message)}</span><span class="tiny muted" style="display:block;margin-top:4px">${ago(n.created_at)} ago &middot; Tap to open the post</span></span></button>`).join('') || '<p class="muted sm">Nothing new. Connect with businesses to hear about new products and stock.</p>');
  else if (S.dv === 'msg') b = '<h2 class="dt">Inboxes / Messages</h2>' + (S.threads.map(t => `<button class="nrow" data-a="msg|${t.peer}" style="align-items:center">${avatar(t.user.profile_pic_url, t.user.full_name, 'sm')}<span class="grow"><b class="sm" style="display:block">${esc(t.user.full_name)}</b><span class="sub" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.last.sender_id === S.user.id ? 'You: ' : ''}${esc(t.last.body)}</span></span>${pill(t.unread)}</button>`).join('') || '<p class="muted sm">No messages yet. Tap Message on a business.</p>');
  else b = fbHtml();
  $('#dp').innerHTML = `<div class="dh"><span>Wantok<b>Connect</b></span><button data-a="dclose" aria-label="Close menu">&times;</button></div>${home ? '' : '<button class="dback" data-a="dv|home">&larr; Back</button>'}${b}`;
}
async function openDrawer(v) { S.dv = v; if (v === 'notif') await loadNotifs(); if (v === 'msg') await loadThreads(); drawDrawer(); $('#dr').hidden = false; }

/* ---------- chat sheet with WhatsApp hand-off ---------- */
function drawChat() {
  const c = S.chat; if (!c || !$('#ms')) return; const mine = [...c.msgs].reverse().find(m => m.sender_id === S.user.id), wa = waLink(c.user.whatsapp_number || c.user.phone_number, mine ? mine.body : 'Hi, I found you on WantokConnect.');
  $('#ms').innerHTML = c.msgs.map(m => `<div class="bub ${m.sender_id === S.user.id ? 'me' : ''}">${esc(m.body)}</div>`).join('') || '<p class="muted sm">Say hello.</p>'; $('#ms').scrollTop = 9e9;
  $('#cwa').hidden = !wa; if (wa) $('#cwa').href = wa;
}
export async function openChat(peer) {
  closeDrawer(); const me = S.user.id;
  const [{ data: u }, { data: msgs }] = await Promise.all([sb.from('users').select('id,full_name,profile_pic_url,whatsapp_number,phone_number').eq('id', peer).single(),
    sb.from('direct_messages').select('*').or(`and(sender_id.eq.${me},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${me})`).order('created_at').limit(100)]);
  S.chat = { peer, user: u, msgs: msgs || [] };
  await sb.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', peer).is('read_at', null); refreshCounts();
  openSheet(`<div class="between" style="margin:0 0 8px"><div class="row" style="flex-wrap:nowrap">${avatar(u.profile_pic_url, u.full_name, 'sm')}<b>${esc(u.full_name)}</b></div><button data-a="chatclose" style="font-size:26px;width:40px;height:40px;text-align:center" aria-label="Close">&times;</button></div>
   <div class="msgs" id="ms"></div><div class="row" style="flex-wrap:nowrap"><input id="ci" class="in" style="margin:0;border-radius:999px" placeholder="Type a message" maxlength="2000"><button class="btn red" data-a="csend">Send</button></div>
   <a id="cwa" class="btn gold-o full" style="margin-top:12px" target="_blank" rel="noopener">Continue on WhatsApp</a>`);
  drawChat();
}
export function onNewMessage(m) {
  if (S.chat && S.chat.peer === m.sender_id) { S.chat.msgs.push(m); drawChat(); sb.from('direct_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => {}); }
  else { S.unreadM++; badges(); toast('New message'); }
}

export const drawerActions = {
  menu: () => openDrawer('home'), bell: () => openDrawer('notif'), dclose: closeDrawer,
  dv: async b => { fbCap(); await openDrawer(b); },
  home: () => go('#/'), nav: h => go(h), prof: id => go('#/profile/' + id),
  readall: async () => { await sb.from('notifications').update({ is_read: true }).eq('user_id', S.user.id).eq('is_read', false); await loadNotifs(); S.unreadN = 0; badges(); drawDrawer(); },
  nopen: async id => { const n = S.notifs.find(x => x.id == id); if (!n) return; if (!n.is_read) { await sb.from('notifications').update({ is_read: true }).eq('id', n.id); S.unreadN = Math.max(0, S.unreadN - 1); badges(); } go(n.post_id ? '#/post/' + n.post_id : '#/profile/' + n.actor_id); },
  msg: id => openChat(id), chatclose: () => { S.chat = null; closeSheet(); },
  csend: async () => { const i = $('#ci'), v = i.value.trim(); if (!v || !S.chat) return; i.value = ''; const { data, error } = await sb.from('direct_messages').insert({ sender_id: S.user.id, recipient_id: S.chat.peer, body: v }).select().single(); if (error) return toast(error.message); S.chat.msgs.push(data); drawChat(); },
  logout: async () => { closeDrawer(); await sb.auth.signOut(); },
  fbr: b => { fbCap(); S.fb.rate = +b; drawDrawer(); }, fbs: b => { fbCap(); S.fb.sales = b; drawDrawer(); },
  fbnew: () => { S.fb = { rate: 0, sales: '', exp: '', imp: '', done: false }; drawDrawer(); },
  fbsend: async () => {
    fbCap(); const F = S.fb, sme = S.user.account_type === 'sme_owner', er = $('#fer');
    if (!F.exp.trim() || !F.imp.trim()) return er.textContent = 'Please fill in both boxes.';
    if (sme && !F.sales) return er.textContent = 'Tell us whether you have made sales.'; if (!sme && !F.rate) return er.textContent = 'Choose a star rating.';
    const { error } = await sb.from('platform_feedback').insert({ user_id: S.user.id, user_role: S.user.account_type, rating: sme ? null : F.rate, sales_reported: sme ? F.sales === 'yes' : null, experience_notes: F.exp.trim(), improvements_suggested: F.imp.trim() });
    if (error) return er.textContent = error.message; S.fb = { rate: 0, sales: '', exp: '', imp: '', done: true }; drawDrawer();
  },
};
