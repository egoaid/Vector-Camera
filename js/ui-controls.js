// ui-controls.js - builds mode tabs, style presets and sliders from a definition table.
import { MODES, MODE_PRESETS, MODE_DEFAULTS } from './config.js';
import { PRESETS } from './style-palette.js';
import { t } from './i18n.js';
import { state, saveSettings } from './state.js';
const $ = (id) => document.getElementById(id);
const ALL = MODES;
const MAIN = [
  { k: 'detail', modes: ALL }, { k: 'simplify', modes: ALL }, { k: 'angularity', modes: ALL },
  { k: 'paletteK', modes: ['regions'], min: 2, max: 24 }, { k: 'subjectSize', modes: ['silhouette', 'hybrid'], min: 5, max: 70 },
  { k: 'separation', modes: ['hybrid'], min: 2, max: 6 }, { k: 'retention', modes: ['hybrid'] }, { k: 'grain', modes: ['hybrid'] }, { k: 'misreg', modes: ['hybrid'] },
];
const ADV = [
  { k: 'halftoneSize', modes: ['hybrid'], min: 3, max: 14, when: (p) => p.halftone > 0 }, { k: 'halftoneAngle', modes: ['hybrid'], min: 0, max: 90, when: (p) => p.halftone > 0 },
  { k: 'roughness', modes: ['hybrid'] }, { k: 'paper', modes: ['hybrid'] },
  { k: 'boundary', modes: ALL }, { k: 'minRegion', modes: ALL }, { k: 'outline', modes: ['vector', 'regions', 'silhouette'] },
  { k: 'semStrength', modes: ALL, when: () => state.engineUsed === 'ai' },
];
function slider(def, onChange) {
  const p = state.params, wrap = document.createElement('div'); wrap.className = 'slider';
  const id = 'sl-' + def.k, row = document.createElement('div'); row.className = 'slider-row';
  const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = t('p.' + def.k);
  const out = document.createElement('output'); out.htmlFor = id; out.textContent = String(p[def.k]);
  row.append(lab, out);
  const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = def.min ?? 0; inp.max = def.max ?? 100; inp.step = 1; inp.value = p[def.k];
  inp.addEventListener('input', () => { state.params[def.k] = +inp.value; out.textContent = inp.value; onChange(def.k); });
  inp.addEventListener('change', saveSettings);
  wrap.append(row, inp); return wrap;
}
function select(key, opts, onChange, labelKey) {
  const f = document.createElement('div'); f.className = 'field';
  const l = document.createElement('label'); l.htmlFor = 'se-' + key; l.textContent = t(labelKey); const s = document.createElement('select'); s.id = 'se-' + key;
  for (const [v, k] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t(k); s.append(o); }
  s.value = String(state.params[key]); s.addEventListener('change', () => { state.params[key] = typeof state.params[key] === 'number' ? +s.value : s.value; saveSettings(); onChange(key); });
  f.append(l, s); return f;
}
function check(key, labelKey, onChange) {
  const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!state.params[key];
  const s = document.createElement('span'); s.textContent = t(labelKey); i.addEventListener('change', () => { state.params[key] = i.checked; saveSettings(); onChange(key); }); l.append(i, s); return l;
}
export function buildControls(onChange, onMode) {
  const p = state.params, mode = p.mode;
  // mode tabs
  const modes = $('modes'); modes.replaceChildren();
  for (const m of MODES) { const b = document.createElement('button'); b.type = 'button'; b.role = 'tab'; b.className = 'mode-tab'; b.textContent = t('mode.' + m); b.setAttribute('aria-selected', String(m === mode)); b.addEventListener('click', () => onMode(m)); modes.append(b); }
  $('mode-desc').textContent = t('mode.' + mode + '.desc');
  // presets
  const pr = $('presets'); pr.replaceChildren();
  const ids = [...MODE_PRESETS[mode], ...(mode === 'silhouette' ? ['custom'] : [])];
  for (const id of ids) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = t('preset.' + id); b.setAttribute('aria-pressed', String(p.preset === id)); b.addEventListener('click', () => onChange('preset', id)); pr.append(b); }
  pr.closest('.field').hidden = ids.length < 2;
  // controls
  const main = $('controls'), adv = $('controls-adv'); main.replaceChildren(); adv.replaceChildren();
  if (mode === 'silhouette' && (p.preset === 'custom' || p.silSample === false && p.preset === 'custom')) {
    const row = document.createElement('div'); row.className = 'color-row';
    for (const g of ['bg', 'mid', 'fg']) { const l = document.createElement('label'), i = document.createElement('input'); i.type = 'color'; i.value = p.silColors[g]; i.addEventListener('input', () => { state.params.silColors[g] = i.value; onChange('silColors'); }); i.addEventListener('change', saveSettings); l.append(t('sil.' + g), i); row.append(l); }
    main.append(row);
  }
  if (mode === 'silhouette') main.append(check('silSample', 'sil.sample', onChange));
  for (const d of MAIN) if (d.modes.includes(mode)) main.append(slider(d, onChange));
  if (mode === 'hybrid') main.append(select('bgTreatment', [['flat', 'bg.flat'], ['photo', 'bg.photo'], ['paper', 'bg.paper']], onChange, 'p.bg'), select('halftone', [[0, 'p.off'], [1, 'p.on']], (k) => { onChange(k); buildControls(onChange, onMode); }, 'p.halftone'));
  if (mode === 'regions') main.append(select('paletteMap', [['luma', 'map.luma'], ['nearest', 'map.nearest']], onChange, 'p.map'));
  for (const d of ADV) if (d.modes.includes(mode) && (!d.when || d.when(p))) adv.append(slider(d, onChange));
  adv.append(check('seal', 'p.seal', onChange));
}
export function presetDefaults(mode, preset) { const pr = PRESETS[preset]; return { bgTreatment: pr && pr.bgTreatment ? pr.bgTreatment : 'flat' }; }
export { MODE_DEFAULTS };
