// ui-link.js - the modulation matrix of the "linked mode" (random settings): depth, cross-modulation and the patch grid (6 sources x 7 destinations).
import { state, saveSettings } from './state.js';
import { t } from './i18n.js';
import { slider } from './ui-controls.js';
import { SOURCES, GROUPS, CELLS, DEST_GROUPS, parseMatrix, matrixToString } from './style-macro.js';
const $ = (id) => document.getElementById(id);

export function buildLinkPanel() {
  const box = $('link-ctl'); if (!box) return; box.replaceChildren(); const p = state.params;
  if (!p.rndOpts.link) return;
  const note = document.createElement('p'); note.className = 'note'; note.textContent = t('lk.note'); box.append(note);
  box.append(slider({ k: 'linkDepth', min: 0, max: 100 }, () => {}), slider({ k: 'linkCross', min: 0, max: 100 }, () => {}));
  const fixed = parseMatrix(p.linkMatrix), shown = fixed || (state.lastLink && state.lastLink.matrix) || null;
  const st = document.createElement('p'); st.className = 'note lk-state'; st.textContent = t(fixed ? 'lk.fixed' : 'lk.random'); box.append(st);
  const grid = document.createElement('div'); grid.className = 'lk-grid'; grid.style.setProperty('--cols', String(GROUPS));
  grid.append(document.createElement('span'));
  for (const g of DEST_GROUPS) { const h = document.createElement('span'); h.className = 'lk-h'; h.textContent = t('lk.g.' + g.id); grid.append(h); }
  const cells = [];
  for (let s = 0; s < SOURCES; s++) {
    const l = document.createElement('span'); l.className = 'lk-h lk-src'; l.textContent = 'M' + (s + 1); grid.append(l);
    for (let g = 0; g < GROUPS; g++) {
      const c = document.createElement('input'); c.type = 'range'; c.min = '-100'; c.max = '100'; c.step = '5'; c.className = 'lk-cell'; c.value = String(shown ? shown[s * GROUPS + g] : 0); c.disabled = !shown && !fixed;
      c.setAttribute('aria-label', 'M' + (s + 1) + ' → ' + t('lk.g.' + DEST_GROUPS[g].id));
      c.addEventListener('change', () => { const m = cells.map((x) => +x.value); state.params.linkMatrix = matrixToString(m); saveSettings(); buildLinkPanel(); });
      cells.push(c); grid.append(c);
    }
  }
  box.append(grid);
  const row = document.createElement('div'); row.className = 'retake-row';
  const mk = (key, fn, dis) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small'; b.textContent = t(key); b.disabled = !!dis; b.addEventListener('click', fn); row.append(b); };
  mk('lk.fix', () => { if (shown) { state.params.linkMatrix = matrixToString(shown); saveSettings(); buildLinkPanel(); } }, !shown || !!fixed);
  mk('lk.free', () => { state.params.linkMatrix = ''; saveSettings(); buildLinkPanel(); }, !fixed);
  box.append(row);
}
