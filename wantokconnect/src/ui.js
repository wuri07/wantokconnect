import { sb } from './supabase.js';

export const S = {
  user: null, ref: { regions: [], provinces: [], cities: [], cats: [] },
  f: { reg: '', prov: '', cat: '' }, q: '', fo: false, posts: [], more: false,
  view: { t: 'feed' }, dv: 'home', notifs: [], threads: [], unreadN: 0, unreadM: 0,
  conn: new Set(), myLocs: [], cp: { m: [] }, pp: { m: [] }, chat: null, fb: { rate: 0, sales: '', exp: '', imp: '', done: false },
  recovering: false, chs: [], refresh: () => {},
  au: { screen: 'in', role: '', name: '', email: '', pw: '', pw2: '', code: '', err: '', info: '', busy: false, cool: 0 },
};
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
export const ago = t => { const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
export const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); };
export const waLink = (num, text) => { const d = String(num || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : ''; };
export const locLabel = l => [l.city_hubs?.name, l.provinces?.name].filter(Boolean).join(', ');
export const avatar = (url, name, cls = '') => url ? `<img class="av ${cls}" src="${esc(url)}" alt="">` : `<div class="av ph ${cls}">${esc((name || '?')[0])}</div>`;
export const openSheet = h => { $('#pn').innerHTML = h; $('#sh').classList.add('on'); };
export const closeSheet = () => $('#sh').classList.remove('on');

export function compress(file, max = 1280, q = .72) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => {
      const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob(b => b ? ok(b) : no(new Error('Could not process the photo')), 'image/jpeg', q);
    };
    i.onerror = () => no(new Error('Could not read that photo')); i.src = u;
  });
}
export function pick(accept = '', multi = false) {
  return new Promise(ok => { const f = $('#file'); f.accept = accept; f.multiple = multi; f.value = ''; f.onchange = () => ok([...f.files]); f.click(); });
}
// Uploads to Storage under <user id>/<uuid>.<ext>. Photos are resized on the phone first to save data.
export async function uploadOne(bucket, file, max = 1280) {
  const img = file.type.startsWith('image/'), body = img ? await compress(file, max) : file;
  const ext = img ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const path = `${S.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, body, { contentType: body.type || 'application/octet-stream', cacheControl: '31536000' });
  if (error) throw error;
  return { kind: img ? 'image' : 'document', name: img ? file.name.replace(/\.\w+$/, '') + '.jpg' : file.name, mime: body.type || file.type, size: body.size, url: sb.storage.from(bucket).getPublicUrl(path).data.publicUrl, path };
}
export async function uploadMedia(files) {
  const out = [];
  for (const f of files) { if (f.size > 10485760) throw new Error(f.name + ' is over 10 MB'); out.push(await uploadOne('post-media', f)); }
  return out;
}
