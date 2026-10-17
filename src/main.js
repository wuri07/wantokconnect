import './styles.css';
import { sb } from './supabase.js';
import { S, $, toast, closeSheet } from './ui.js';
import { authActions, drawAuth } from './auth.js';
import { filterActions, drawFilter } from './filters.js';
import { feedActions, renderFeedView, loadFeed, focusPost, stockUpdate, drawList } from './feed.js';
import { profileActions, renderProfile } from './profile.js';
import { drawerActions, badges, refreshCounts, onNewMessage } from './drawer.js';
import { initOffline } from './offline.js';

// Landing from the link in the confirmation email: tell the person it worked (or expired), then clean the address bar.
(() => {
  const h = location.hash + location.search;
  if (/error_code=otp_expired|error=access_denied/.test(h)) { Object.assign(S.au, { screen: 'in', needConfirm: true, err: 'That link has expired. Enter your email and tap Resend confirmation email.' }); history.replaceState(null, '', location.pathname); }
  else if (/access_token=|type=signup|type=email/.test(h)) { Object.assign(S.au, { screen: 'in', info: 'Email confirmed. Log in to continue.' }); history.replaceState(null, '', location.pathname); }
})();

const ACT = { ...authActions, ...filterActions, ...feedActions, ...profileActions, ...drawerActions };
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const [a, b, c] = t.dataset.a.split('|'), fn = ACT[a];
  if (fn) { try { await fn(b, c, t); } catch (err) { toast(err.message || 'Something went wrong'); } }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#dr').hidden = true; closeSheet(); }
  if (e.key !== 'Enter') return;
  if (e.target.closest('#au')) ACT[{ in: 'ago', up: 'ago', forgot: 'asend', otp: 'averify', reset: 'areset' }[S.au.screen]]?.();
  if (e.target.id === 'ci') ACT.csend();
});

async function loadRef() {
  const [r, p, c, k] = await Promise.all(['png_regions', 'provinces', 'city_hubs', 'categories'].map(t => sb.from(t).select('*').order(t === 'categories' ? 'id' : 'name')));
  S.ref = { regions: r.data || [], provinces: p.data || [], cities: c.data || [], cats: k.data || [] };
}
function stopLive() { S.chs.forEach(c => sb.removeChannel(c)); S.chs = []; }
// Realtime: live stock badges, new-notification alerts and incoming messages.
function live() {
  stopLive(); const me = S.user.id, ch = (n, table, event, filter, fn) => sb.channel(n).on('postgres_changes', { event, schema: 'public', table, ...(filter && { filter }) }, fn).subscribe();
  S.chs = [ch('wc-n', 'notifications', 'INSERT', `user_id=eq.${me}`, p => { S.unreadN++; badges(); toast(p.new.message); }),
    ch('wc-m', 'direct_messages', 'INSERT', `recipient_id=eq.${me}`, p => onNewMessage(p.new)),
    ch('wc-s', 'sme_products', 'UPDATE', null, p => stockUpdate(p.new)),
    ch('wc-p', 'marketplace_posts', 'DELETE', null, p => { S.posts = S.posts.filter(x => x.id !== p.old.id); if (S.view.t === 'feed') drawList(); })];
}
async function route() {
  if (!S.user) return; const [, t, id] = location.hash.split('/'); closeSheet();
  if (t === 'profile' && id) { S.view = { t: 'profile', id }; drawFilter(); await renderProfile(id); scrollTo(0, 0); }
  else {
    S.view = { t: 'feed' }; if (t === 'post' && id) { S.f = { reg: '', prov: '', cat: '' }; S.q = ''; }
    drawFilter(); renderFeedView(); if (t === 'post' && id) await focusPost(id); else await loadFeed(true);
  }
}
async function boot(session) {
  if (!session || S.recovering) { if (!session) { S.user = null; stopLive(); $('#app').innerHTML = ''; $('#fb').innerHTML = ''; } $('#au').hidden = false; drawAuth(); return; }
  if (!S.ref.cats.length) await loadRef();
  const q = () => sb.from('users').select('*').eq('id', session.user.id).maybeSingle();
  let { data: u } = await q(); if (!u) { await new Promise(r => setTimeout(r, 800)); ({ data: u } = await q()); }
  if (!u) { toast('Your profile is not ready. Run the SQL files in supabase/migrations, then log in again.'); await sb.auth.signOut(); return; }
  S.user = u; S.fb = { rate: 0, sales: '', exp: '', imp: '', done: false };
  const [c, l] = await Promise.all([sb.from('user_connections').select('following_id').eq('follower_id', u.id),
    u.account_type === 'sme_owner' ? sb.from('business_locations').select('id,province_id,city_hub_id,provinces(name),city_hubs(name)').eq('user_id', u.id) : { data: [] }]);
  S.conn = new Set((c.data || []).map(x => x.following_id)); S.myLocs = l.data || [];
  await refreshCounts(); $('#au').hidden = true; live(); initOffline(); await route();
}
S.refresh = () => S.view.t === 'feed' ? drawList() : renderProfile(S.view.id);
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED') return;
  if (ev === 'SIGNED_IN' && session && S.user?.id === session.user.id) return;
  setTimeout(() => boot(session), 0);   // never await Supabase calls directly inside this callback
});
window.addEventListener('wc-boot', e => boot(e.detail));
window.addEventListener('hashchange', route);
