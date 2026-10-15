// i18n.js - tiny dictionary-based localisation (ja / en). Static HTML ships in Japanese for SEO; English is swapped in by JS.
import { JA } from './i18n-ja.js';
import { EN } from './i18n-en.js';
import { JA2 } from './i18n-ja-v2.js';
import { EN2 } from './i18n-en-v2.js';
import { STYLES_JA, STYLES_EN } from './i18n-styles.js';
import { MANUAL_JA } from './i18n-manual-ja.js';
import { MANUAL_EN } from './i18n-manual-en.js';
import { JA3 } from './i18n-ja-v3.js';
import { EN3 } from './i18n-en-v3.js';
const DICT = { ja: { ...JA, ...JA2, ...STYLES_JA, ...MANUAL_JA, ...JA3 }, en: { ...EN, ...EN2, ...STYLES_EN, ...MANUAL_EN, ...EN3 } };
let lang = 'ja';
export const getLang = () => lang;
export function detectLang() {
  try { const s = localStorage.getItem('vc.lang'); if (s && DICT[s]) return s; } catch { /* ignore */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? DICT.ja[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
  return s;
}
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); }); // trusted dictionary strings only
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
  document.documentElement.lang = lang;
}
export function setLang(l) {
  if (!DICT[l]) return; lang = l; try { localStorage.setItem('vc.lang', l); } catch { /* ignore */ }
  applyDom(); document.dispatchEvent(new CustomEvent('vc:lang', { detail: l }));
}
export function initLang() { lang = detectLang(); applyDom(); }
