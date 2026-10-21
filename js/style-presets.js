// style-presets.js - complete "styles": built-in looks (every look parameter, not just the palette) and the user's own
// saved styles (every parameter), plus the JSON file format used to export / import them. Pure functions (no DOM).
//
// Terminology: a PALETTE (params.preset) is only the colour set. A STYLE is a complete parameter set - mode, palette,
// segmentation, tone, halftone, lines ... - so applying it reproduces a whole look in one tap.
import { DEFAULT_PARAMS, MODES } from './config.js';
import { PRESETS } from './style-palette.js';
import { HT_TYPES } from './halftone-types.js';
import { TONES, TONINGS } from './tone-photo.js';
import { FONTS } from './style-text.js';
import { APP_VERSION } from './version.js';

/** Settings of the device / session, never part of a style. */
const DEVICE_KEYS = new Set(['quality', 'engine', 'wakeLock', 'exportLong', 'vecInk', 'vecInkLong', 'vecInkSpeck', 'rndOpts', 'rndStyle', 'lock', 'faceEngine']);
/** Every parameter a user style stores (look + texts + collage). */
export const STYLE_KEYS = Object.keys(DEFAULT_PARAMS).filter((k) => !DEVICE_KEYS.has(k));
/** The look only (no wording / collage layout): what the built-in styles define. */
export const LOOK_KEYS = STYLE_KEYS.filter((k) => !/^text/.test(k) && !/^collage/.test(k));

const clone = (v) => JSON.parse(JSON.stringify(v));
const pickKeys = (src, keys) => { const o = {}; for (const k of keys) if (k in src) o[k] = clone(src[k]); return o; };

/** Built-in styles: `params` lists the differences from the defaults; everything else is reset to the default. */
export const BUILTIN_STYLES = [
  // ---- hybrid (screen-print): ink drawn over flat colour blocks
  { id: 'etching', params: { mode: 'hybrid', preset: 'etching', bgTreatment: 'photo', detail: 38, simplify: 40, curveFit: 60, regionSmooth: 55, subjectSize: 32, separation: 3, retention: 60, grain: 6, roughness: 0, misreg: 0, paper: 45, halftone: 1, halftoneType: 'etching', halftoneSize: 6, halftoneAngle: 45, htWeight: 55, htLayers: 3, htSpread: 60, htCurve: 45, htSketch: 45, htLen: 50, htDepth: 55, htContour: 40, htFlow: 35, htKinds: 70, htShade: 70, htHairLong: 70 } },
  { id: 'sanguine', params: { mode: 'hybrid', preset: 'sanguine', bgTreatment: 'photo', detail: 36, simplify: 40, curveFit: 60, regionSmooth: 55, separation: 3, retention: 65, grain: 8, roughness: 0, misreg: 0, paper: 50, halftone: 1, halftoneType: 'etching', halftoneSize: 6, halftoneAngle: 35, htWeight: 50, htLayers: 3, htCurve: 50, htSketch: 55, htLen: 55, htFlow: 45, htKinds: 70, htShade: 70, htHairLong: 80 } },
  { id: 'engraving', params: { mode: 'hybrid', preset: 'unite', bgTreatment: 'photo', curveFit: 55, separation: 3, retention: 70, grain: 5, misreg: 0, paper: 30, halftone: 1, halftoneType: 'engrave', halftoneSize: 5, halftoneAngle: 30, htWeight: 55, htCurve: 50, htWave: 50, htWaveLen: 50, htGuilloche: 40 } },
  { id: 'pen', params: { mode: 'hybrid', preset: 'kraft', bgTreatment: 'photo', curveFit: 55, separation: 3, retention: 60, grain: 10, misreg: 0, paper: 45, halftone: 1, halftoneType: 'cross', halftoneSize: 6, halftoneAngle: 45, htLayers: 3, htSpread: 60, htCurve: 40, htSketch: 60 } },
  { id: 'silver', params: { mode: 'hybrid', preset: 'silver', bgTreatment: 'photo', detail: 30, simplify: 30, curveFit: 70, regionSmooth: 65, separation: 6, retention: 95, grain: 60, roughness: 40, misreg: 0, paper: 35, halftone: 0, tone: 'silver', sgBlack: 8, sgWhite: 92, sgContrast: 56, sgCurve: 60, sgGrain: 52, sgGrainSize: 40, sgGrainRough: 45 } },
  { id: 'sepia', params: { mode: 'hybrid', preset: 'sepia', bgTreatment: 'photo', detail: 30, simplify: 30, curveFit: 70, regionSmooth: 65, separation: 6, retention: 90, grain: 45, roughness: 35, misreg: 0, paper: 50, halftone: 0, tone: 'silver', sgBlack: 5, sgWhite: 90, sgContrast: 52, sgCurve: 55, sgGrain: 42, sgGrainSize: 38, sgGrainRough: 40, sgToning: 'sepia', sgToningAmt: 70 } },
  { id: 'twotone', params: { mode: 'hybrid', preset: 'mono', bgTreatment: 'photo', detail: 36, simplify: 30, misreg: 0, paper: 20, halftone: 0, tone: 'twotone', ttThreshold: 52, ttBias: 50, ttAdaptive: 20, ttDetail: 40, ttEdge: 25, ttClean: 25, ttBreakup: 0 } },
  { id: 'cyanotype', params: { mode: 'hybrid', preset: 'etchblue', bgTreatment: 'photo', detail: 34, simplify: 32, misreg: 0, paper: 35, halftone: 0, tone: 'twotone', ttStrict: false, ttThreshold: 48, ttBias: 50, ttAdaptive: 30, ttDetail: 45, ttEdge: 15, ttClean: 20, ttBreakup: 0 } },
  { id: 'silkscreen', params: { mode: 'hybrid', preset: 'riso', bgTreatment: 'flat', detail: 40, separation: 3, retention: 40, grain: 35, roughness: 30, misreg: 60, paper: 50, halftone: 1, halftoneType: 'dot', halftoneSize: 6, halftoneAngle: 45 } },
  { id: 'popart', params: { mode: 'hybrid', preset: 'pop', bgTreatment: 'flat', detail: 40, separation: 3, retention: 30, grain: 8, roughness: 5, misreg: 12, paper: 15, halftone: 1, halftoneType: 'dot', halftoneSize: 9, halftoneAngle: 45, htWeight: 60, lineWidth: 30, lineScope: 'all', lineColor: '#17121c', lineOffset: 0 } },
  { id: 'sleeve', params: { mode: 'hybrid', preset: 'sleeve', bgTreatment: 'photo', separation: 4, retention: 55, grain: 35, roughness: 25, misreg: 20, paper: 40, halftone: 0 } },
  // ---- shape & texture (vector / colour regions), with or without a tone / halftone layer on top
  { id: 'vector', params: { mode: 'vector', preset: 'natural', detail: 62, simplify: 30, angularity: 20, curveFit: 60, regionSmooth: 55, paletteK: 0, outline: 0 } },
  { id: 'vecetch', params: { mode: 'vector', preset: 'etching', detail: 58, simplify: 32, angularity: 15, curveFit: 70, regionSmooth: 60, paletteK: 0, separation: 3, retention: 60, grain: 6, roughness: 0, halftone: 1, halftoneType: 'etching', halftoneSize: 6, halftoneAngle: 45, htWeight: 50, htLayers: 3, htCurve: 45, htSketch: 45, htLen: 50, htFlow: 35, htKinds: 70, htShade: 70, htHairLong: 70 } },
  { id: 'vecsilver', params: { mode: 'vector', preset: 'silver', detail: 55, simplify: 30, angularity: 15, curveFit: 75, regionSmooth: 65, paletteK: 0, separation: 6, retention: 90, grain: 45, roughness: 30, tone: 'silver', sgBlack: 8, sgWhite: 92, sgContrast: 52, sgCurve: 55, sgGrain: 40, sgGrainSize: 38, sgGrainRough: 40 } },
  { id: 'vectwo', params: { mode: 'vector', preset: 'mono', detail: 55, simplify: 30, angularity: 20, curveFit: 60, regionSmooth: 50, paletteK: 0, tone: 'twotone', ttThreshold: 50, ttBias: 50, ttAdaptive: 25, ttDetail: 40, ttEdge: 20, ttClean: 25, ttBreakup: 0 } },
  { id: 'vechalf', params: { mode: 'vector', preset: 'pop', htColor: '#d6336c', detail: 55, simplify: 35, angularity: 25, curveFit: 55, regionSmooth: 50, paletteK: 0, separation: 3, retention: 35, grain: 10, roughness: 5, halftone: 1, halftoneType: 'dot', halftoneSize: 8, halftoneAngle: 45, htWeight: 55 } },
  { id: 'poster', params: { mode: 'regions', preset: 'natural', detail: 40, simplify: 40, angularity: 40, curveFit: 45, regionSmooth: 45, paletteK: 6, paletteMap: 'nearest' } },
  { id: 'posterdot', params: { mode: 'regions', preset: 'pop', detail: 38, simplify: 45, angularity: 40, curveFit: 45, regionSmooth: 45, paletteK: 6, paletteMap: 'nearest', separation: 3, retention: 30, grain: 8, roughness: 5, halftone: 1, halftoneType: 'dot', halftoneSize: 9, halftoneAngle: 45, htWeight: 55, outline: 25 } },
  { id: 'silhouette', params: { mode: 'silhouette', preset: 'pop', detail: 24, simplify: 45, angularity: 35, subjectSize: 30 } },
];
/** The complete look of a built-in style (defaults + differences). */
export const expandBuiltin = (def) => ({ ...pickKeys(DEFAULT_PARAMS, LOOK_KEYS), ...clone(def.params) });
/** Colours the user has locked (colour tab): styles and random generation leave them alone. */
export const LOCK_KEYS = { palette: ['preset', 'customPreset', 'silColors'], htColor: ['htColor'], lineColor: ['lineColor', 'lineColor2'] };
export const lockedKeys = (cur) => Object.entries(LOCK_KEYS).filter(([g]) => cur.lock && cur.lock[g]).flatMap(([, ks]) => ks);
const keepLocked = (cur, next) => { for (const k of lockedKeys(cur)) if (k in cur) next[k] = clone(cur[k]); return next; };
/** Applies a built-in style to the current params; the wording of the texts, the collage layout and device settings stay. */
export const applyBuiltin = (cur, def) => keepLocked(cur, { ...cur, ...expandBuiltin(def) });
/** True while the current params still match every look parameter of the style. */
export const isBuiltinActive = (cur, def) => { const full = expandBuiltin(def), skip = new Set(lockedKeys(cur)); return LOOK_KEYS.every((k) => skip.has(k) || JSON.stringify(cur[k]) === JSON.stringify(full[k])); };

// ---------- user styles ----------
// CONTRACT (v0.8.1): a My Style stores EVERY look / text / collage parameter (STYLE_KEYS). Restoring it sets every one of
// those keys to the saved value, so the result does not depend on what was set before. Exceptions, all explicit:
//  - colour locks (Colour tab): a locked group keeps the CURRENT colours; `lockConflicts()` tells which locked values differ from the saved style;
//  - keys missing from an older / external style take LEGACY_VALUES (the value that reproduces the look from before the key existed) or the default;
//  - device settings (DEVICE_KEYS) and per-photo edits (manual foreground / background fixes, selected text slot) are never part of a style.
/** Values that reproduce the pre-existence look of a key that was added after styles may have been saved. */
export const LEGACY_VALUES = { htKinds: 0, htColor: '', htShade: 0, htHairLong: 0, curveFit: 0, regionSmooth: 0 };
const missingValue = (k) => clone(k in LEGACY_VALUES ? LEGACY_VALUES[k] : DEFAULT_PARAMS[k]);
export const snapshotStyle = (cur) => pickKeys(cur, STYLE_KEYS);
/** The complete saved configuration of a style (sanitised; missing keys filled as described above). */
export function fullStyleParams(style) { const p = sanitizeParams(style.params), out = {}; for (const k of STYLE_KEYS) out[k] = k in p ? p[k] : missingValue(k); return out; }
export const applyUser = (cur, style) => keepLocked(cur, { ...cur, ...fullStyleParams(style) });
export const isUserActive = (cur, style) => { const p = fullStyleParams(style), skip = new Set(lockedKeys(cur)); return STYLE_KEYS.every((k) => skip.has(k) || JSON.stringify(cur[k]) === JSON.stringify(p[k])); };
/** Locked colour groups whose current values differ from what the style saved (they stay as they are): ['palette', 'htColor', 'lineColor'] subset. */
export function lockConflicts(cur, style) {
  const p = fullStyleParams(style); return Object.entries(LOCK_KEYS).filter(([g, ks]) => cur.lock && cur.lock[g] && ks.some((k) => JSON.stringify(cur[k]) !== JSON.stringify(p[k]))).map(([g]) => g);
}

const HEX = /^#[0-9a-f]{6}$/i, hexOk = (v) => typeof v === 'string' && HEX.test(v);
const RANGE = { frameSeed: [0, 1e6], lightDir: [0, 359], inkSeed: [0, 1e6], wcSeed: [0, 1e6], framePlateN: [1, 3], hueShift: [-180, 180], halftoneSize: [2, 20], halftoneAngle: [0, 180], separation: [2, 8], paletteK: [0, 32], textAngle: [-90, 90], textSize: [1, 100], textSpacing: [-10, 50], htLayers: [1, 4], htSpread: [10, 90], collageSlots: [0, 16], collageSeed: [0, 1e6], textSeed: [0, 1e6], textHalftoneSize: [2, 20], textHalftoneAngle: [0, 180] };
const rangeOf = (k) => RANGE[k.replace(/_\d$/, '')] || [0, 100];
const ENUMS = { mode: MODES, halftoneType: HT_TYPES, textHalftoneType: HT_TYPES, textLang: ['en', 'ja'], wcPaper: ['hot', 'cold', 'tinted'], wcLine: ['none', 'etching', 'pen', 'pencil'], bgTreatment: ['flat', 'photo', 'paper'], paletteMap: ['luma', 'nearest'], lineScope: ['mid', 'fg', 'all'], collageLayout: null, collageEdge: null, collageAspect: null, background: null, textHalftoneMode: ['down', 'up', 'right', 'flat'], tone: TONES, sgToning: TONINGS };
const validPalette = (p) => p && typeof p === 'object' && ['key', 'bands'].includes(p.mode) && hexOk(p.ink) && hexOk(p.paper) && p.groups && ['bg', 'mid', 'fg'].every((g) => p.groups[g] && Array.isArray(p.groups[g].block) && p.groups[g].block.length > 0 && p.groups[g].block.length <= 8 && p.groups[g].block.every(hexOk) && (!p.groups[g].ramp || (Array.isArray(p.groups[g].ramp) && p.groups[g].ramp.length >= 2 && p.groups[g].ramp.length <= 8 && p.groups[g].ramp.every(hexOk))));
/** Keeps only known keys with the right type and a sane range (a style file is untrusted input). */
export function sanitizeParams(src) {
  const out = {}; if (!src || typeof src !== 'object') return out;
  for (const k of STYLE_KEYS) {
    if (!(k in src)) continue; const v = src[k], d = DEFAULT_PARAMS[k], base = k.replace(/_\d$/, '');
    if (k === 'customPreset') { if (v === null || validPalette(v)) out[k] = clone(v); continue; }
    if (k === 'preset') { if (typeof v === 'string' && (v === 'random' || v === 'custom' || Object.hasOwn(PRESETS, v))) out[k] = v; continue; }
    if (k === 'silColors') { if (v && ['bg', 'mid', 'fg'].every((g) => hexOk(v[g]))) out[k] = { bg: v.bg, mid: v.mid, fg: v.fg }; continue; }
    if (base === 'textFont') { if (FONTS.some((f) => f.id === v)) out[k] = v; continue; }
    if (ENUMS[base] && !ENUMS[base].includes(v)) continue;
    if (typeof d === 'number') { if (typeof v === 'number' && Number.isFinite(v)) { const [lo, hi] = rangeOf(k); out[k] = Math.min(hi, Math.max(lo, v)); } continue; }
    if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v; continue; }
    if (typeof d === 'string') { if (typeof v !== 'string') continue; if ((/Color$|Color2$|Colors?$|^lineColor/.test(base) && base !== 'htColor' && base !== 'frameColor') || (d.startsWith('#') && base !== 'collagePaper')) { if (hexOk(v)) out[k] = v; } else if (base === 'collagePaper' || base === 'htColor' || base === 'frameColor') { if (v === '' || hexOk(v)) out[k] = v; } else if (/^text(_\d)?$/.test(k)) out[k] = v.slice(0, 80); else out[k] = v.slice(0, 40); }
  }
  return out;
}

// ---------- storage ----------
const STORE = 'vc.userStyles.v1', MAX_STYLES = 60;
export function loadUserStyles() {
  try { const a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && s.params && typeof s.params === 'object') : []; } catch { return []; }
}
export function saveUserStyles(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, MAX_STYLES))); return true; } catch { return false; } }
export const newId = () => 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
export const cleanName = (n) => String(n || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 40);
/** Adds ` (2)`, ` (3)` ... when the name is already used. */
export function uniqueName(list, name, exceptId = null) {
  const taken = new Set(list.filter((s) => s.id !== exceptId).map((s) => s.name)); if (!taken.has(name)) return name;
  for (let i = 2; i < 1000; i++) { const c = `${name.slice(0, 34)} (${i})`; if (!taken.has(c)) return c; }
  return name;
}
export const MAX_USER_STYLES = MAX_STYLES;

// ---------- JSON files ----------
const FORMAT = 1;
export function styleToJSON(styles) {
  const one = (s) => ({ name: s.name, created: s.created || new Date().toISOString(), params: sanitizeParams(s.params) });
  const head = { app: 'Vector Camera', format: FORMAT, appVersion: APP_VERSION };
  return JSON.stringify(styles.length === 1 ? { ...head, kind: 'style', ...one(styles[0]) } : { ...head, kind: 'styles', styles: styles.map(one) }, null, 2);
}
/** Parses a style file (one style or several). Returns [{ name, created, params }] (sanitised) or throws Error('invalid'). */
export function parseStyleJSON(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error('invalid'); }
  if (!o || typeof o !== 'object' || o.app !== 'Vector Camera') throw new Error('invalid');
  const list = o.kind === 'styles' && Array.isArray(o.styles) ? o.styles : o.kind === 'style' ? [o] : null; if (!list) throw new Error('invalid');
  const out = list.slice(0, MAX_STYLES).map((s, i) => ({ name: cleanName(s && s.name) || `Style ${i + 1}`, created: typeof (s && s.created) === 'string' ? s.created.slice(0, 40) : new Date().toISOString(), params: sanitizeParams(s && s.params) })).filter((s) => Object.keys(s.params).length > 0);
  if (!out.length) throw new Error('invalid'); return out;
}
