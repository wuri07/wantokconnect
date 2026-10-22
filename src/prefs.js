// Personal settings kept on this device (theme, text size, data saver, pop-up alerts). Applied as soon as the app loads.
const KEY = 'wc-prefs';
export const THEMES = { dark: '#09090B', light: '#F5F6F8', blue: '#E6F0FA', green: '#E7F5EC' };   // value = browser bar colour
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
export const prefs = { theme: 'dark', size: 'normal', dataSaver: false, popups: true, ...saved };
if (!THEMES[prefs.theme]) prefs.theme = 'dark';
export function applyPrefs() {
  const r = document.documentElement; r.dataset.theme = prefs.theme; r.dataset.size = prefs.size;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[prefs.theme]);
}
export function setPref(k, v) { prefs[k] = v; try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ } applyPrefs(); }
applyPrefs();
