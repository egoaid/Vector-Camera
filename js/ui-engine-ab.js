// ui-engine-ab.js - A/B comparison of the two face engines on the CURRENT photo. Runs both engines when the person asks (never in the background),
// shows each result side by side (landmarks drawn on the photo) with plain numbers, and lets the person adopt either one. It does not rank the engines
// and never changes the selected engine by itself.
import { state } from './state.js';
import { t } from './i18n.js';
import { detectFacesDetailed } from './face-landmarks.js';
import { meanDisplacement, pairFaces } from './face-engines.js';
const $ = (id) => document.getElementById(id), MAXW = 340;
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
function draw(cv, res, color) {
  const src = state.canvas, w = Math.min(MAXW, src.width), h = Math.round((src.height * w) / src.width); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.drawImage(src, 0, 0, w, h);
  for (const f of res.faces) {
    x.fillStyle = color; for (let i = 0; i < 468; i += 1) x.fillRect(f[i].x * w - 0.8, f[i].y * h - 0.8, 1.6, 1.6);
    x.strokeStyle = color; x.lineWidth = 1.5; x.beginPath(); OVAL.forEach((i, k) => (k ? x.lineTo(f[i].x * w, f[i].y * h) : x.moveTo(f[i].x * w, f[i].y * h))); x.closePath(); x.stroke();
  }
}
const fmt = (r) => (r.status === 'ok' ? t('face.ab.found').replace('{n}', String(r.faces.length)).replace('{ms}', String(r.ms)) : r.status === 'none' ? t('face.ab.none').replace('{ms}', String(r.ms)) : r.status === 'unavailable' ? t('face.st.unavailable').replace('{e}', t('face.eng.' + r.engine)).replace('{why}', t('face.why.' + (r.reason || 'unknown'))) : t('face.st.error').replace('{e}', t('face.eng.' + r.engine)).replace('{why}', r.reason || ''));
export async function openAB() {
  const dlg = $('dlg-face-ab'); if (!dlg || !state.canvas) return;
  const out = $('ab-body'); out.textContent = t('face.ab.running'); for (const id of ['ab-use-a', 'ab-use-b']) $(id).disabled = true;
  if (!dlg.open) dlg.showModal();
  const A = await detectFacesDetailed(state.canvas, { engine: 'legacy' }), B = await detectFacesDetailed(state.canvas, { engine: 'modern' });
  out.replaceChildren();
  const col = (title, res, color) => { const d = document.createElement('div'); d.className = 'ab-col'; const h = document.createElement('h3'); h.textContent = title; const cv = document.createElement('canvas'); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', title); draw(cv, res, color); const p = document.createElement('p'); p.className = 'note'; p.textContent = fmt(res); d.append(h, cv, p); return d; };
  const row = document.createElement('div'); row.className = 'ab-row'; row.append(col('A: ' + t('face.eng.legacy'), A, '#ffd23f'), col('B: ' + t('face.eng.modern'), B, '#3cb7c9')); out.append(row);
  const pairs = A.faces.length && B.faces.length ? pairFaces(A.faces, B.faces) : [], cmp = document.createElement('p'); cmp.className = 'note';
  cmp.textContent = pairs.length ? t('face.ab.diff').replace('{d}', (pairs.reduce((s, [i, j]) => s + meanDisplacement(A.faces[i], B.faces[j]), 0) / pairs.length * 100).toFixed(1)) : t('face.ab.nodiff');
  const neutral = document.createElement('p'); neutral.className = 'note'; neutral.textContent = t('face.ab.neutral'); out.append(cmp, neutral);
  $('ab-use-a').disabled = false; $('ab-use-b').disabled = false;
}
export function initAB() {
  const dlg = $('dlg-face-ab'); if (!dlg) return;
  const use = (id) => { dlg.close(); document.dispatchEvent(new CustomEvent('vc:face-engine', { detail: id })); };
  $('ab-use-a').addEventListener('click', () => use('legacy')); $('ab-use-b').addEventListener('click', () => use('modern')); $('ab-close').addEventListener('click', () => dlg.close());
}
