import { S, $, esc, toast } from './ui.js';
import { api, isNet } from './api.js';

const label = s => ({ none: 'Not verified', pending: 'Under review', verified: 'Verified', rejected: 'Not approved' }[s] || s);
const tone = s => s === 'verified' ? 'tag' : s === 'rejected' ? 'on' : '';
let st = null;
export async function renderVerify() {
  $('#app').innerHTML = '<p class="pad muted">Loading...</p>';
  try { st = await api('/verification/status'); } catch (e) { $('#app').innerHTML = `<p class="note">${isNet(e) ? 'Verification needs a connection. Try again when you have signal.' : esc(e.message)}</p>`; return; }
  const sme = st.account_type === 'sme_owner';
  $('#app').innerHTML = `<div class="pad"><h1 style="margin:0 0 4px;font-size:20px">Verification</h1><p class="muted sm" style="margin:0">Verified members build trust and appear first in search.</p></div>
   <section class="sec"><div class="between" style="margin:0 0 12px"><h2 style="margin:0">National ID</h2><span class="chip ${tone(st.national_id_status)}">${label(st.national_id_status)}</span></div>
   ${st.national_id_status === 'verified' ? '<p class="muted sm" style="margin:0">Your profile shows the ID Verified badge.</p>'
     : st.national_id_status === 'pending' ? '<p class="muted sm" style="margin:0">We are checking your ID. This can take a few days.</p>'
     : `<p class="muted sm" style="margin-top:0">Enter your National ID number. We keep only a scrambled (hashed) copy and never show it to anyone.</p><input id="vid" class="in" autocomplete="off" maxlength="20" placeholder="National ID number"><button class="btn red full" data-a="vsubmit">Submit for verification</button><p class="err" id="ver"></p>`}</section>
   ${sme ? `<section class="sec"><div class="between" style="margin:0 0 12px"><h2 style="margin:0">Physical Storefront</h2><span class="chip ${tone(st.storefront_status)}">${label(st.storefront_status === 'none' ? 'none' : st.storefront_status)}</span></div>
   ${st.storefront_status === 'verified' ? '<p class="muted sm" style="margin:0">Your listings show the gold Physical Storefront Verified badge.</p>'
     : st.storefront_status === 'pending' ? '<p class="muted sm" style="margin:0">We are reviewing your storefront photos.</p>'
     : `<p class="muted sm" style="margin-top:0">Upload clear photos of your shop, stall or workplace, then request verification. You have ${st.photos} photo${st.photos === 1 ? '' : 's'} so far.</p><div class="row"><button class="btn gold-o" data-a="prof|${S.user.id}">Add photos</button><button class="btn red" data-a="vstore">Request verification</button></div><p class="err" id="vse"></p>`}</section>` : ''}`;
}
export const verifyActions = {
  vsubmit: async () => {
    const er = $('#ver'), v = $('#vid').value; if (!navigator.onLine) return er.textContent = 'You need a connection to verify.';
    try { await api('/verification/national-id', { method: 'POST', body: { id_number: v } }); $('#vid').value = ''; toast('Submitted for review'); renderVerify(); } catch (e) { er.textContent = e.message; }
  },
  vstore: async () => { try { await api('/verification/storefront', { method: 'POST' }); toast('Request sent'); renderVerify(); } catch (e) { $('#vse').textContent = e.message; } },
};
