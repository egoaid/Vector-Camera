// pwa.js - service worker registration, update notice, cache clearing.
import { t } from './i18n.js';
import { toast } from './ui-toast.js';
export async function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  try {
    const reg = await navigator.serviceWorker.register('service-worker.js');
    const had = !!navigator.serviceWorker.controller;
    reg.addEventListener('updatefound', () => { const nw = reg.installing; if (nw) nw.addEventListener('statechange', () => { if (nw.state === 'installed' && had) toast(t('toast.update'), { ms: 12000, action: { label: t('sw.reload'), run: () => location.reload() } }); }); });
  } catch { /* offline support is optional */ }
}
export async function clearAll() {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ }
  try { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); } catch { /* ignore */ }
}
