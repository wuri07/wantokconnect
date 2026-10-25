import { sb } from './supabase.js';
import { S, $, esc, toast } from './ui.js';

const A = () => S.au;
const okMail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const friendly = m => /already registered|already been registered/i.test(m) ? 'That email already has an account. Log in instead.'
  : /invalid login/i.test(m) ? 'Wrong email or password.' : /not confirmed/i.test(m) ? 'Confirm your email first. Check your inbox.'
  : /rate limit|too many|seconds/i.test(m) ? 'Too many emails or tries. Wait a few minutes and try again.' : /expired|invalid/i.test(m) ? 'That code is wrong or has expired. Request a new one.'
  : /signups not allowed|not found/i.test(m) ? 'No account found for that email.' : m;
const cap = () => { [['aname', 'name'], ['aemail', 'email'], ['apw', 'pw'], ['apw2', 'pw2'], ['acode', 'code']].forEach(([i, k]) => { const e = $('#' + i); if (e) A()[k] = e.value; }); };
const fail = m => { A().err = friendly(m); A().busy = false; drawAuth(); };
const busy = async fn => { if (A().busy) return; cap(); A().busy = true; A().err = ''; drawAuth(); try { await fn(); } catch (e) { fail(e.message || 'Something went wrong'); return; } A().busy = false; drawAuth(); };

export function drawAuth() {
  cap();
  const a = A(), sc = a.screen, up = sc === 'up', dis = a.busy ? 'disabled' : '';
  const f = (id, type, ph, val, extra = '') => `<input id="${id}" class="in" type="${type}" placeholder="${ph}" value="${esc(val)}" ${extra}>`;
  const tabs = `<div class="tabs"><button data-a="atab|up" class="${up ? 'on' : ''}">Sign up</button><button data-a="atab|in" class="${sc === 'in' ? 'on' : ''}">Log in</button></div>`;
  const head = '<div style="font-size:24px;font-weight:800">Wantok<span class="gold">Connect</span> <small class="muted" style="font-size:14px;font-weight:400">Market</small></div>';
  let body = '';
  if (sc === 'in' || up) body = `${tabs}
    ${up ? f('aname', 'text', 'Full name or business name', a.name, 'autocomplete="name" maxlength="100"') : ''}
    ${f('aemail', 'email', 'Email address', a.email, 'autocomplete="email" inputmode="email"')}
    ${f('apw', 'password', 'Password (8+ characters)', a.pw, `autocomplete="${up ? 'new-password' : 'current-password'}"`)}
    ${up ? `<div><div class="b sm" style="margin-bottom:8px">I am a...</div><div class="roles">${[['sme_owner', 'Business owner', 'Post products and services'], ['customer', 'Customer', 'Browse and arrange on WhatsApp']].map(r => `<button class="role ${a.role === r[0] ? 'on' : ''}" data-a="arole|${r[0]}"><b class="sm">${r[1]}</b><small>${r[2]}</small></button>`).join('')}</div></div>` : '<button class="gold sm" data-a="aforgot" style="align-self:flex-start">Forgot password?</button>'}
    <button class="btn red full" data-a="ago" ${dis}>${a.busy ? 'Please wait...' : up ? (a.role === 'sme_owner' ? 'Create business account' : a.role === 'customer' ? 'Create customer account' : 'Create account') : 'Log in'}</button>${a.needConfirm && !up ? '<button class="gold sm" data-a="aresend" style="align-self:flex-start">Resend confirmation email</button>' : ''}`;
  else if (sc === 'forgot') body = `<h2 style="margin:0">Reset your password</h2><p class="muted sm" style="margin:0">Enter your email. We will send you a one-time code.</p>
    ${f('aemail', 'email', 'Email address', a.email, 'autocomplete="email" inputmode="email"')}
    <button class="btn red full" data-a="asend" ${dis}>${a.busy ? 'Sending...' : 'Send code'}</button><button class="muted sm" data-a="atab|in" style="align-self:flex-start">&larr; Back to log in</button>`;
  else if (sc === 'otp') body = `<h2 style="margin:0">Enter your code</h2><p class="muted sm" style="margin:0">We sent a code to <b>${esc(a.email)}</b>. It expires soon, so use it now.</p>
    ${f('acode', 'text', 'Code from your email', a.code, 'inputmode="numeric" autocomplete="one-time-code" maxlength="8"')}
    <button class="btn red full" data-a="averify" ${dis}>${a.busy ? 'Checking...' : 'Verify code'}</button>
    <div class="row between"><button class="gold sm" data-a="asend">Send a new code</button><button class="muted sm" data-a="atab|in">Cancel</button></div>`;
  else body = `<h2 style="margin:0">Choose a new password</h2>
    ${f('apw', 'password', 'New password (8+ characters)', a.pw, 'autocomplete="new-password"')}${f('apw2', 'password', 'Confirm new password', a.pw2, 'autocomplete="new-password"')}
    <button class="btn red full" data-a="areset" ${dis}>${a.busy ? 'Saving...' : 'Save password'}</button>`;
  $('#au').innerHTML = `<div class="auw">${head}<p class="muted sm" style="margin:0">PNG's very own online SME marketplace</p>${body}${a.info ? `<p class="ok">${esc(a.info)}</p>` : ''}<p class="err" role="alert">${esc(a.err)}</p></div>`;
}

export const authActions = {
  atab: b => { cap(); Object.assign(A(), { screen: b, err: '', info: '', pw: '', pw2: '', code: '' }); drawAuth(); },
  arole: b => { A().role = b; drawAuth(); },
  aresend: () => busy(async () => {
    const a = A(), email = a.email.trim().toLowerCase();
    if (!okMail(email)) throw new Error('Enter your email address first.');
    if (Date.now() < (a.rcool || 0)) { toast('Wait ' + Math.ceil((a.rcool - Date.now()) / 1000) + ' seconds before asking again.'); return; }
    const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin } });
    if (error) throw error;
    a.rcool = Date.now() + 60000; a.info = 'Confirmation email sent. Check your inbox and spam folder.';
  }),
  aforgot: () => { cap(); Object.assign(A(), { screen: 'forgot', err: '', info: '' }); drawAuth(); },
  ago: () => busy(async () => {
    const a = A(), email = a.email.trim().toLowerCase();
    if (!okMail(email)) throw new Error('Enter a valid email address.');
    if (a.pw.length < 8) throw new Error('Password needs 8 or more characters.');
    if (a.screen === 'up') {
      if (a.name.trim().length < 2) throw new Error('Enter your full name or business name.');
      if (!a.role) throw new Error('Choose whether you are a business owner or a customer.');
      const { data, error } = await sb.auth.signUp({ email, password: a.pw, options: { data: { full_name: a.name.trim(), account_type: a.role }, emailRedirectTo: location.origin } });
      if (error) throw error;
      if (!data.session) { Object.assign(a, { screen: 'in', pw: '', needConfirm: true, info: 'Account created. Check your email (and spam) to confirm it, then log in.' }); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: a.pw });
      if (error) { if (/not confirmed/i.test(error.message)) a.needConfirm = true; throw error; }
      a.pw = '';
    }
  }),
  // Step 1: email a one-time code. shouldCreateUser:false stops this from creating accounts for strangers.
  asend: () => busy(async () => {
    const a = A(), email = a.email.trim().toLowerCase();
    if (!okMail(email)) throw new Error('Enter a valid email address.');
    if (a.screen === 'otp' && Date.now() < a.cool) { toast('Wait ' + Math.ceil((a.cool - Date.now()) / 1000) + ' seconds before asking again.'); return; }
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw error;
    Object.assign(a, { email, screen: 'otp', code: '', cool: Date.now() + 30000, info: 'Code sent. Check your inbox and spam folder.' });
  }),
  // Step 2: verifying the code signs the user in. recovering=true keeps them on the reset screen instead of the app.
  averify: () => busy(async () => {
    const a = A(), token = a.code.replace(/\s/g, '');
    if (!/^\d{6,8}$/.test(token)) throw new Error('Enter the numbers from your email.');
    S.recovering = true;
    const { error } = await sb.auth.verifyOtp({ email: a.email, token, type: 'email' });
    if (error) { S.recovering = false; throw error; }
    Object.assign(a, { screen: 'reset', info: '', pw: '', pw2: '' });
  }),
  // Step 3: set the new password on the now-verified session.
  areset: () => busy(async () => {
    const a = A();
    if (a.pw.length < 8) throw new Error('Password needs 8 or more characters.');
    if (a.pw !== a.pw2) throw new Error('The two passwords do not match.');
    const { error } = await sb.auth.updateUser({ password: a.pw });
    if (error) throw error;
    S.recovering = false; Object.assign(a, { pw: '', pw2: '', screen: 'in', info: '' }); toast('Password updated');
    const { data } = await sb.auth.getSession(); window.dispatchEvent(new CustomEvent('wc-boot', { detail: data.session }));
  }),
};
