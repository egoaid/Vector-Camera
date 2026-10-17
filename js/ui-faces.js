// ui-faces.js - face detection selector (Face Landmarker / off) and live status line. Shown in the etching halftone section.
import { state } from './state.js';
import { t } from './i18n.js';
export const statusText = (s) => {
  if (!s) return t('face.st.idle');
  const e = t('face.eng.' + s.engine);
  if (s.status === 'ok') return t('face.st.ok').replace('{e}', e).replace('{n}', String(s.faces)).replace('{ms}', String(s.ms));
  if (s.status === 'none') return t('face.st.none').replace('{e}', e);
  if (s.status === 'off') return t('face.st.off');
  if (s.status === 'unavailable') return t('face.st.unavailable').replace('{e}', e).replace('{why}', t('face.why.' + (s.reason || 'unknown')));
  return t('face.st.error').replace('{e}', e).replace('{why}', s.reason || '');
};
/** Appends the engine group to `box`. Changing it dispatches `vc:face-engine` (app.js re-detects and redraws). */
export function buildFaceEngine(box) {
  const wrap = document.createElement('div'); wrap.className = 'face-engine';
  const f = document.createElement('div'); f.className = 'field'; const l = document.createElement('label'); l.htmlFor = 'se-faceEngine'; l.textContent = t('p.faceEngine');
  const s = document.createElement('select'); s.id = 'se-faceEngine';
  for (const id of ['modern', 'off']) { const o = document.createElement('option'); o.value = id; o.textContent = t('face.eng.' + id); s.append(o); }
  s.value = state.params.faceEngine || 'modern';
  s.addEventListener('change', () => document.dispatchEvent(new CustomEvent('vc:face-engine', { detail: s.value })));
  f.append(l, s);
  const st = document.createElement('p'); st.className = 'note face-status'; st.id = 'face-status'; st.setAttribute('role', 'status'); st.textContent = statusText(state.faceStatus);
  const hint = document.createElement('p'); hint.className = 'note'; hint.textContent = t('face.hint');
  wrap.append(f, st, hint); box.append(wrap);
}
document.addEventListener('vc:face-status', () => { const el = document.getElementById('face-status'); if (el) el.textContent = statusText(state.faceStatus); });
