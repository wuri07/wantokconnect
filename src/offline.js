import { $ } from './ui.js';

// Small offline helpers: shows an "Offline mode" pill and registers the app-shell service worker (public/sw.js).
const pill = () => { const el = $('#off'); el.textContent = 'Offline mode: you can still read what has loaded. Posting needs signal.'; el.hidden = navigator.onLine; };
export function initOffline() {
  addEventListener('online', pill); addEventListener('offline', pill); pill();
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
