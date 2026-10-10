// wake-lock.js - Screen Wake Lock API: keeps the phone awake while the app is in use.
// The lock is released by the browser whenever the page is hidden, so it is re-acquired on visibilitychange.
let sentinel = null, wanted = false, listeners = new Set(), lastError = '';
export const isSupported = () => 'wakeLock' in navigator && typeof navigator.wakeLock.request === 'function';
const emit = () => listeners.forEach((fn) => fn(status()));
export const status = () => ({ supported: isSupported(), wanted, active: !!sentinel && !sentinel.released, error: lastError });
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

async function acquire() {
  if (!wanted || !isSupported() || document.visibilityState !== 'visible') return emit();
  if (sentinel && !sentinel.released) return emit();
  try {
    sentinel = await navigator.wakeLock.request('screen'); lastError = '';
    sentinel.addEventListener('release', () => { emit(); });
  } catch (e) { sentinel = null; lastError = (e && e.name) || 'error'; } // e.g. low battery / power-saver
  emit();
}
export async function enable() { wanted = true; await acquire(); }
export async function disable() { wanted = false; try { if (sentinel) await sentinel.release(); } catch { /* ignore */ } sentinel = null; emit(); }
export function init() {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
  // Some browsers only grant the lock after a user gesture: retry on the first interactions.
  const retry = () => { if (wanted && !(sentinel && !sentinel.released)) acquire(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, retry, { passive: true }));
  window.addEventListener('pageshow', retry);
}
