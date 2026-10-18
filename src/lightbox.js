// Fullscreen photo viewer: tap a photo to enlarge it. Swipe or use the arrows for more photos; tap, press Esc or use the X to close.
const $ = s => document.querySelector(s);
let urls = [], i = 0, sx = 0;
const show = () => { $('#lbi').src = urls[i]; $('#lbc').textContent = urls.length > 1 ? `${i + 1} / ${urls.length}` : ''; $('#lb').classList.toggle('single', urls.length < 2); };
export function openLightbox(list, idx = 0) {
  urls = list.filter(Boolean); if (!urls.length) return;
  i = Math.min(Math.max(idx, 0), urls.length - 1); show();
  $('#lb').hidden = false; document.body.style.overflow = 'hidden'; $('#lbx').focus();
}
export function closeLightbox() { $('#lb').hidden = true; $('#lbi').removeAttribute('src'); document.body.style.overflow = ''; }
const step = d => { if (urls.length < 2) return; i = (i + d + urls.length) % urls.length; show(); };
document.addEventListener('keydown', e => {
  if ($('#lb').hidden) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); closeLightbox(); }
  else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
});
document.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', e => { if ($('#lb').hidden) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }, { passive: true });
export const lightboxActions = { lbclose: closeLightbox, lbprev: () => step(-1), lbnext: () => step(1) };
