// ui-views.js - screen switching and the processing overlay.
import { t } from './i18n.js';
const $ = (id) => document.getElementById(id);
export function showScreen(name) {
  for (const el of document.querySelectorAll('.screen')) { const on = el.id === 'screen-' + name; el.classList.toggle('active', on); el.hidden = !on; }
  window.scrollTo(0, 0); document.dispatchEvent(new CustomEvent('vc:screen', { detail: name }));
}
export function showProcessing(key, frac = 0, vars) {
  $('processing').hidden = false; $('proc-stage').textContent = t(key, vars); $('proc-bar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
}
export const hideProcessing = () => { $('processing').hidden = true; };
export function showError(id, msg) { const el = $(id); if (!el) return; el.textContent = msg || ''; el.hidden = !msg; }
