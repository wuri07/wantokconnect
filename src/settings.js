import { sb } from './supabase.js';
import { S, $, esc, toast } from './ui.js';
import { prefs, setPref } from './prefs.js';

// name, label, note, page colour, card colour, button colour
const THEME_LIST = [['dark', 'Dark', 'Default', '#09090B', '#121214', '#FF1E38'], ['light', 'Light', '', '#F5F6F8', '#FFFFFF', '#D10F2D'], ['blue', 'Light blue', '', '#E6F0FA', '#FFFFFF', '#1D6FD1'], ['green', 'Light green', '', '#E7F5EC', '#FFFFFF', '#15803D']];
const row = (a, t, sub, on) => `<button class="srow" role="switch" aria-checked="${on}" data-a="${a}"><span><b class="sm" style="display:block">${t}</b><span class="sub">${sub}</span></span><span class="sw ${on ? 'on' : ''}"><i></i></span></button>`;
const sec = (t, sub, h) => `<section class="sec"><h2>${t}</h2>${sub ? `<p class="muted sm" style="margin:-6px 0 12px">${sub}</p>` : ''}${h}</section>`;

export async function renderSettings() {
  const app = $('#app'); app.className = 'wrap narrow';
  const { data } = await sb.auth.getSession(), email = data.session?.user?.email || '';
  app.innerHTML = `<button class="back" data-a="back">&larr; Back</button><div class="chead"><h1>Settings</h1></div>
   ${sec('Appearance', 'Choose how WantokConnect looks on this device.', `<div class="theme-grid">${THEME_LIST.map(t => `<button class="theme ${prefs.theme === t[0] ? 'on' : ''}" data-a="theme|${t[0]}" aria-pressed="${prefs.theme === t[0]}"><span class="sw3"><i style="background:${t[3]}"></i><i style="background:${t[4]}"></i><i style="background:${t[5]}"></i></span><b>${t[1]}${prefs.theme === t[0] ? '<span class="gold">&#10003;</span>' : ''}</b>${t[2] ? `<span class="tiny muted">${t[2]}</span>` : ''}</button>`).join('')}</div>
    <div class="srow" style="margin-top:12px"><span><b class="sm" style="display:block">Text size</b><span class="sub">Make text smaller or larger</span></span><span class="row">${[['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']].map(s => `<button class="chip ${prefs.size === s[0] ? 'on' : ''}" data-a="size|${s[0]}">${s[1]}</button>`).join('')}</span></div>`)}
   ${sec('Data and photos', '', row('pref|dataSaver', 'Data saver', 'Feed photos load only when you tap them, so they use less data.', prefs.dataSaver))}
   ${sec('Notifications', '', row('pref|popups', 'Pop-up alerts', 'Show a message at the bottom of the screen when something new arrives.', prefs.popups))}
   ${sec('Privacy', '', row('disc', 'Show me in Find People', 'Other members can find your profile by searching your name. Your posts and business listings stay visible either way.', S.user.discoverable !== false))}
   ${sec('Account', '', `<div class="srow"><span><b class="sm" style="display:block">${esc(S.user.full_name)}</b><span class="sub">${esc(email)} &middot; ${S.user.account_type === 'sme_owner' ? 'Business owner' : 'Customer'}</span></span></div><div class="row" style="margin-top:12px"><button class="btn gold-o" data-a="prof|${S.user.id}">Edit my profile</button><button class="btn line-o" data-a="logout">Log out</button></div>`)}
   ${sec('About', '', '<p class="muted sm" style="margin:0">WantokConnect Market. Free for everyone in Papua New Guinea.</p>')}`;
}
export const settingsActions = {
  theme: b => { setPref('theme', b); renderSettings(); },
  size: b => { setPref('size', b); renderSettings(); },
  pref: k => { setPref(k, !prefs[k]); renderSettings(); },
  disc: async () => { const v = S.user.discoverable === false; const { error } = await sb.from('users').update({ discoverable: v }).eq('id', S.user.id); if (error) return toast(error.message); S.user.discoverable = v; renderSettings(); },
};
