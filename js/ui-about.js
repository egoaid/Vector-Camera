// ui-about.js - version / licence dialog.
import { t } from './i18n.js';
import { APP_NAME, APP_VERSION, BUILD_ID, BUILD_DATE, PIPELINE_REV, SETTINGS_SCHEMA, MODULE_VERSIONS, COPYRIGHT } from './version.js';
import { AI } from './config.js';
import { clearAll } from './pwa.js';
import { toast } from './ui-toast.js';
const $ = (id) => document.getElementById(id);
const row = (a, b) => { const tr = document.createElement('tr'), x = document.createElement('td'), y = document.createElement('td'); x.textContent = a; y.textContent = b; tr.append(x, y); return tr; };
function render() {
  const body = $('about-body'); body.replaceChildren();
  const p = document.createElement('p'); p.textContent = `${APP_NAME} v${APP_VERSION} (build ${BUILD_ID}, ${BUILD_DATE})`; p.style.fontWeight = '800'; body.append(p);
  const t1 = document.createElement('table'); t1.className = 'about-table';
  t1.append(row('Pipeline', PIPELINE_REV), row('Settings schema', String(SETTINGS_SCHEMA)), row(t('about.models'), `SegFormer-B0 ADE20K (${AI.model}, ${AI.dtype})`), row('Transformers.js', AI.transformersVersion));
  body.append(t1);
  const d = document.createElement('details'), s = document.createElement('summary'); s.textContent = t('about.modules'); d.append(s);
  const t2 = document.createElement('table'); t2.className = 'about-table'; for (const [k, v] of Object.entries(MODULE_VERSIONS)) t2.append(row(k, v)); d.append(t2); body.append(d);
  const lic = document.createElement('details'), ls = document.createElement('summary'); ls.textContent = t('about.licenses'); lic.append(ls);
  for (const line of [COPYRIGHT, 'Optional subject-detection model (image segmentation only; loaded at runtime, not bundled): Transformers.js (Apache-2.0), ONNX Runtime Web (MIT), SegFormer-B0 ADE20K weights (NVIDIA licence: research / evaluation use).']) { const q = document.createElement('p'); q.className = 'note'; q.textContent = line; lic.append(q); }
  body.append(lic);
  const pr = document.createElement('p'); pr.className = 'note'; pr.textContent = t('about.privacy'); body.append(pr);
}
export function initAbout() {
  const dlg = $('dlg-about');
  $('btn-about').addEventListener('click', () => { render(); dlg.showModal(); });
  $('btn-about-close').addEventListener('click', () => dlg.close());
  $('btn-clear-cache').addEventListener('click', async () => { await clearAll(); toast(t('about.clear.done')); setTimeout(() => location.reload(), 600); });
  document.addEventListener('vc:lang', () => { if (dlg.open) render(); });
}
