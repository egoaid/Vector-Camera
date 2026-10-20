// ui-controls.js - builds mode tabs, style presets and sliders from a definition table.
import { MODES, MODE_PRESETS, MODE_DEFAULTS, INK_MODES, needsInk } from './config.js';
import { PRESETS, getPreset } from './style-palette.js';
import { t } from './i18n.js';
import { HT_TYPES } from './halftone-types.js';
import { state, saveSettings } from './state.js';
import { buildTone } from './ui-tone.js';
import { buildFaceEngine } from './ui-faces.js';
const $ = (id) => document.getElementById(id);
const ALL = MODES;
const MAIN = [
  { k: 'detail', modes: ALL, g: 'shape' }, { k: 'simplify', modes: ALL, g: 'shape' }, { k: 'angularity', modes: ALL, g: 'shape' }, { k: 'curveFit', modes: ALL, g: 'shape' }, { k: 'regionSmooth', modes: ALL, g: 'shape' },
  { k: 'paletteK', modes: ['regions'], min: 2, max: 24, g: 'shape' }, { k: 'subjectSize', modes: ['silhouette', 'hybrid'], min: 5, max: 70, g: 'subject' },
  ...['wcBleed', 'wcEdge', 'wcGran', 'wcLight', 'wcHl', 'wcBloom'].map((k) => ({ k, modes: ['watercolor'], g: 'wc' })),
  { k: 'separation', modes: INK_MODES, min: 2, max: 6, g: 'tone', when: needsInk }, { k: 'retention', modes: INK_MODES, g: 'tone', when: needsInk }, { k: 'grain', modes: INK_MODES, g: 'tone', when: needsInk }, { k: 'misreg', modes: ['hybrid'], g: 'tone' },
];
const GROUP_ORDER = ['shape', 'subject', 'wc', 'tone'], openGroups = new Set(['shape']);
function group(id, content) {
  const d = document.createElement('details'); d.className = 'grp'; d.open = openGroups.has(id); const sm = document.createElement('summary'); sm.textContent = t('grp.' + id);
  d.addEventListener('toggle', () => { d.open ? openGroups.add(id) : openGroups.delete(id); }); d.append(sm, ...content); return d;
}
const ADV = [
  { k: 'roughness', modes: INK_MODES, when: needsInk }, { k: 'lightDir', modes: ALL, min: 0, max: 359 }, { k: 'hueShift', modes: ALL, min: -180, max: 180 }, { k: 'paper', modes: ['hybrid'] },
  { k: 'boundary', modes: ALL }, { k: 'minRegion', modes: ALL }, { k: 'outline', modes: ['vector', 'regions', 'silhouette'] },
  { k: 'semStrength', modes: ALL, when: () => state.engineUsed === 'ai' },
];
export function slider(def, onChange) {
  const p = state.params, wrap = document.createElement('div'); wrap.className = 'slider';
  const id = 'sl-' + def.k, row = document.createElement('div'); row.className = 'slider-row';
  const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = t('p.' + (def.base || def.k));
  const out = document.createElement('output'); out.htmlFor = id; out.textContent = String(p[def.k]);
  row.append(lab, out);
  const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = def.min ?? 0; inp.max = def.max ?? 100; inp.step = 1; inp.value = p[def.k];
  inp.addEventListener('input', () => { state.params[def.k] = +inp.value; out.textContent = inp.value; onChange(def.k); });
  inp.addEventListener('change', saveSettings);
  wrap.append(row, inp); return wrap;
}
export function select(key, opts, onChange, labelKey) {
  const f = document.createElement('div'); f.className = 'field';
  const l = document.createElement('label'); l.htmlFor = 'se-' + key; l.textContent = t(labelKey); const s = document.createElement('select'); s.id = 'se-' + key;
  for (const [v, k] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t(k); s.append(o); }
  s.value = String(state.params[key]); s.addEventListener('change', () => { state.params[key] = typeof state.params[key] === 'number' ? +s.value : s.value; saveSettings(); onChange(key); });
  f.append(l, s); return f;
}
export function check(key, labelKey, onChange) {
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
  const ids = [...MODE_PRESETS[mode], ...(p.customPreset ? ['random'] : []), ...(mode === 'silhouette' ? ['custom'] : [])];
  for (const id of ids) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = t('preset.' + id); b.setAttribute('aria-pressed', String(p.preset === id)); b.addEventListener('click', () => onChange('preset', id)); pr.append(b); }
  pr.closest('.field').hidden = ids.length < 2;
  { const f = pr.closest('.field'); f.querySelector('.preset-note')?.remove(); if (mode === 'vector') { const n = document.createElement('p'); n.className = 'note preset-note'; n.textContent = t('preset.vec.note'); f.append(n); } }
  // controls
  const main = $('controls'), adv = $('controls-adv'); main.replaceChildren(); adv.replaceChildren();
  if (mode === 'silhouette') main.append(check('silSample', 'sil.sample', onChange));
  for (const g of GROUP_ORDER) { const items = MAIN.filter((d) => d.g === g && d.modes.includes(mode) && (!d.when || d.when(p))).map((d) => slider(d, onChange)); if (g === 'wc' && mode === 'watercolor') items.unshift(select('wcPaper', [['hot', 'wc.paper.hot'], ['cold', 'wc.paper.cold'], ['rough', 'wc.paper.rough'], ['washi', 'wc.paper.washi'], ['tinted', 'wc.paper.tinted']], onChange, 'p.wcPaper'));
    if (g === 'tone' && mode === 'hybrid') items.unshift(select('bgTreatment', [['flat', 'bg.flat'], ['photo', 'bg.photo'], ['paper', 'bg.paper']], onChange, 'p.bg')); if (items.length) main.append(group(g, items)); }
  buildTone(onChange, mode); buildHalftone(onChange, mode);
  if (mode === 'regions') main.append(select('paletteMap', [['luma', 'map.luma'], ['nearest', 'map.nearest']], onChange, 'p.map'));
  for (const d of ADV) if (d.modes.includes(mode) && (!d.when || d.when(p))) adv.append(slider(d, onChange));
  adv.append(check('seal', 'p.seal', onChange));
}
export function presetDefaults(mode, preset) { const pr = preset === 'random' ? state.params.customPreset : PRESETS[preset]; return { bgTreatment: pr && pr.bgTreatment ? pr.bgTreatment : 'flat' }; }
export { MODE_DEFAULTS };

/** Halftone section: on/off, type and the detail controls of the chosen type (hybrid mode only). */
export function buildHalftone(onChange, mode = state.params.mode) {
  const box = $('halftone-ctl'); if (!box) return; box.replaceChildren(); const p = state.params;
  if (!INK_MODES.includes(mode)) { const n = document.createElement('p'); n.className = 'note'; n.textContent = t('ht.hybridonly'); box.append(n); return; }
  const re = (k) => { onChange(k); buildHalftone(onChange, mode); };
  box.append(select('halftone', [[0, 'p.off'], [1, 'p.on']], re, 'p.halftone'));
  if (!(p.halftone > 0)) return;
  box.append(select('halftoneType', HT_TYPES.map((x) => [x, 'ht.' + x]), re, 'p.htype'));
  const n = document.createElement('p'); n.className = 'note'; n.textContent = t('ht.desc.' + (p.halftoneType || 'dot')); box.append(n);
  const S = (k, min, max) => slider({ k, min, max }, onChange), ty = p.halftoneType || 'dot';
  box.append(S('halftoneSize', 3, 14), S('halftoneAngle', 0, 90), S('htWeight', 0, 100));
  if (p.tone === 'silver' || p.tone === 'twotone') box.append(S('htMix', 0, 100));
  if (ty === 'line') box.append(S('htCurve', 0, 100));
  if (ty === 'cross') box.append(S('htLayers', 2, 3), S('htSpread', 20, 90), S('htCurve', 0, 100), S('htSketch', 0, 100));
  if (ty === 'etching') box.append(S('htLayers', 1, 4), S('htSpread', 20, 90), S('htCurve', 0, 100), S('htSketch', 0, 100), S('htLen', 0, 100), S('htDepth', 0, 100), S('htContour', 0, 100), S('htFlow', 0, 100), S('htKinds', 0, 100), S('htShade', 0, 100), S('htHairLong', 0, 100));
    if (p.htKinds > 0) { const n2 = document.createElement('p'); n2.className = 'note'; n2.textContent = t('ht.regions.note'); box.append(n2, S('htRegSkin'), S('htRegCheek'), S('htRegEyes'), S('htRegBrows'), S('htRegNose'), S('htRegLips'), S('htRegHair')); buildFaceEngine(box); }
  if (ty === 'engrave') box.append(S('htWave', 0, 100), S('htWaveLen', 0, 100), S('htGuilloche', 0, 100), S('htCurve', 0, 100));
}
