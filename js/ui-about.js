// ui-about.js - version / licence dialog (user-facing info only; technical versions live in VERSION.md).
import { t } from './i18n.js';
import { APP_NAME, APP_VERSION, BUILD_ID, BUILD_DATE, COPYRIGHT } from './version.js';
import { clearAndReload } from './pwa.js';
const $ = (id) => document.getElementById(id);
const para = (text, cls) => { const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = text; return p; };
function render() {
  const body = $('about-body'); body.replaceChildren();
  const v = para(`${APP_NAME} v${APP_VERSION} (build ${BUILD_ID}, ${BUILD_DATE})`); v.style.fontWeight = '800'; body.append(v);
  const h = document.createElement('h3'); h.textContent = t('about.licenses'); body.append(h);
  body.append(para(COPYRIGHT, 'note'), para(t('about.thirdparty'), 'note'), para(t('about.privacy')));
}
export function initAbout() {
  const dlg = $('dlg-about');
  $('btn-about').addEventListener('click', () => { render(); dlg.showModal(); });
  $('btn-about-close').addEventListener('click', () => dlg.close());
  $('btn-clear-cache').addEventListener('click', clearAndReload);
  document.addEventListener('vc:lang', () => { if (dlg.open) render(); });
}
