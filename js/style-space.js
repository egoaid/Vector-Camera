// style-space.js - the complete parameter space of the look, and the sampler that random generation draws from.
// Pure functions (no DOM). Every look parameter is listed here once, with its UI range, the part of the random generation
// ("target") it belongs to, and when it matters (mode / tone / halftone type). Random generation can therefore reach EVERY
// combination the controls allow: structure first (mode, tone, halftone, palette, background), then every parameter that
// is meaningful for that structure. A parameter that does not matter for the chosen structure is left untouched.
//
// A "tendency" (style-tendency.js) is only a bias: weights for the structural choices and narrower value windows. Nothing
// is forced; with the tendency off the sampler uses the full space (values come from a pleasant window most of the time,
// from the whole UI range now and then, so extreme settings stay reachable).
import { INK_MODES, MODE_PRESETS, MODE_DEFAULTS, needsInk } from './config.js';
import { PRESETS, STYLE_ORDER } from './style-palette.js';
import { HT_TYPES } from './halftone-types.js';
import { TONES, TONINGS } from './tone-photo.js';
import { randomPreset, randomColor } from './style-colors.js';

export const TARGETS = ['mode', 'palette', 'shape', 'tone', 'halftone', 'texture', 'background', 'subject', 'lines', 'frame'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => Math.round(a + r() * (b - a));
/** Weighted pick from { value: weight } (weights <= 0 are never picked). */
export function wpick(r, w) {
  const e = Object.entries(w).filter(([, x]) => x > 0), sum = e.reduce((s, [, x]) => s + x, 0); let u = r() * sum;
  for (const [k, x] of e) { u -= x; if (u <= 0) return k; }
  return e[e.length - 1][0];
}

const ink = (n) => needsInk(n);                       // an ink layer exists (hybrid always; vector / regions with a tone or halftone)
const ht = (n) => INK_MODES.includes(n.mode) && n.halftone > 0;
const hty = (...t) => (n) => ht(n) && t.includes(n.halftoneType || 'dot');
const tone = (t) => (n) => INK_MODES.includes(n.mode) && n.tone === t;
const I = (k, target, lo, hi, plo, phi, o = {}) => ({ k, target, kind: 'int', lo, hi, plo, phi, ...o });
const E = (k, target, vals, o = {}) => ({ k, target, kind: 'enum', vals, ...o });
const B = (k, target, p, o = {}) => ({ k, target, kind: 'bool', p, ...o });
const C = (k, target, gen, o = {}) => ({ k, target, kind: 'custom', gen, ...o });

/**
 * The space. ORDER MATTERS: structural entries come first because the `when` of the later ones reads the structure that was
 * drawn (the "next" state = current params + what has been drawn so far).
 */
export const SPACE = [
  // ---- structure
  C('mode', 'mode', (r, n, x) => {
    const w = { ...(x.bias.modes || { hybrid: 5, vector: 2.5, regions: 2, silhouette: 1, watercolor: 2.5 }) };
    if (n.lock && n.lock.palette) for (const m of Object.keys(w)) if (!palList(m).includes(n.preset) && !(n.preset === 'random' && n.customPreset) && !(n.preset === 'custom' && m === 'silhouette')) w[m] = 0; // a locked palette must stay valid
    return Object.values(w).some((v) => v > 0) ? { mode: wpick(r, w) } : {};
  }),
  C('preset', 'palette', (r, n, x) => palettePatch(r, n, x)),                        // also customPreset, silColors, silSample
  C('tone', 'tone', (r, n, x) => (INK_MODES.includes(n.mode) ? { tone: wpick(r, x.bias.tones || { classic: 5, silver: 2, twotone: 2 }) } : {})),
  C('halftone', 'halftone', (r, n, x) => (INK_MODES.includes(n.mode) ? (r() < (x.bias.ht ?? 0.4) ? { halftone: 1, halftoneType: wpick(r, x.bias.types || { dot: 3, line: 1.5, cross: 1.5, engrave: 1.5, etching: 2 }) } : { halftone: 0 }) : {})),
  C('bgTreatment', 'background', (r, n, x) => (n.mode === 'hybrid' ? { bgTreatment: pick(r, x.bias.bg || ['flat', 'flat', 'photo', 'paper']) } : {})),
  // ---- shape (every mode)
  I('detail', 'shape', 0, 100, 20, 70), I('boundary', 'shape', 0, 100, 30, 70), I('simplify', 'shape', 0, 100, 15, 65), I('angularity', 'shape', 0, 100, 0, 70),
  I('curveFit', 'shape', 0, 100, 20, 95), I('regionSmooth', 'shape', 0, 100, 20, 85), I('minRegion', 'shape', 0, 100, 10, 60),
  I('paletteK', 'shape', 2, 24, 4, 12, { when: (n) => n.mode === 'regions' }),
  B('seal', 'shape', 0.6),
  E('paletteMap', 'palette', ['luma', 'nearest'], { when: (n) => n.mode === 'regions' }),
  I('subjectSize', 'subject', 5, 70, 14, 52, { when: (n) => n.mode === 'silhouette' || n.mode === 'hybrid' }),
  // ---- texture (needs an ink layer)
  I('separation', 'texture', 2, 6, 2, 5, { when: ink }), I('retention', 'texture', 0, 100, 20, 90, { when: ink }), I('grain', 'texture', 0, 100, 0, 60, { when: ink }),
  I('roughness', 'texture', 0, 100, 0, 50, { when: ink }), I('misreg', 'texture', 0, 100, 0, 60, { when: (n) => n.mode === 'hybrid' }), I('paper', 'texture', 0, 100, 10, 60, { when: (n) => n.mode === 'hybrid' }),
  // ---- tone: silver-gelatin
  I('sgBlack', 'tone', 0, 100, 0, 22, { when: tone('silver') }), I('sgWhite', 'tone', 0, 100, 78, 100, { when: tone('silver') }), I('sgContrast', 'tone', 0, 100, 38, 68, { when: tone('silver') }),
  I('sgCurve', 'tone', 0, 100, 38, 72, { when: tone('silver') }), I('sgGrain', 'tone', 0, 100, 12, 70, { when: tone('silver') }), I('sgGrainSize', 'tone', 0, 100, 15, 70, { when: tone('silver') }), I('sgGrainRough', 'tone', 0, 100, 10, 70, { when: tone('silver') }),
  E('sgToning', 'tone', TONINGS, { when: tone('silver'), w: { none: 2, sepia: 1, selenium: 1 } }), I('sgToningAmt', 'tone', 0, 100, 30, 80, { when: (n) => tone('silver')(n) && n.sgToning && n.sgToning !== 'none' }),
  // ---- tone: two-tone
  I('ttThreshold', 'tone', 0, 100, 38, 62, { when: tone('twotone') }), I('ttBias', 'tone', 0, 100, 38, 62, { when: tone('twotone') }), I('ttAdaptive', 'tone', 0, 100, 10, 60, { when: tone('twotone'), zero: 0.5 }),
  I('ttDetail', 'tone', 0, 100, 10, 60, { when: tone('twotone') }), I('ttEdge', 'tone', 0, 100, 10, 50, { when: tone('twotone'), zero: 0.5 }), I('ttClean', 'tone', 0, 100, 0, 40, { when: tone('twotone') }),
  I('ttBreakup', 'tone', 0, 100, 5, 30, { when: tone('twotone'), zero: 0.6 }), B('ttStrict', 'tone', 0.7, { when: tone('twotone') }),
  // ---- halftone
  I('halftoneSize', 'halftone', 3, 14, 4, 10, { when: ht }), C('halftoneAngle', 'halftone', (r, n, x) => (ht(n) ? { halftoneAngle: r() < 0.65 ? pick(r, x.bias.angles || [15, 45, 75]) : range(r, 0, 90) } : {}), { when: ht }),
  I('htWeight', 'halftone', 0, 100, 30, 70, { when: ht }), I('htMix', 'halftone', 0, 100, 25, 80, { when: (n) => ht(n) && (n.tone === 'silver' || n.tone === 'twotone') }),
  I('htLayers', 'halftone', 1, 4, 2, 3, { when: hty('cross', 'etching'), rng: (n) => (n.halftoneType === 'cross' ? [2, 3] : [1, 4]) }), I('htSpread', 'halftone', 20, 90, 40, 80, { when: hty('cross', 'etching') }),
  I('htCurve', 'halftone', 0, 100, 20, 70, { when: hty('line', 'cross', 'etching', 'engrave') }), I('htSketch', 'halftone', 0, 100, 20, 65, { when: hty('cross', 'etching') }),
  I('htLen', 'halftone', 0, 100, 30, 70, { when: hty('etching') }), I('htDepth', 'halftone', 0, 100, 30, 80, { when: hty('etching'), zero: 0.1 }), I('htContour', 'halftone', 0, 100, 20, 55, { when: hty('etching'), zero: 0.1 }),
  I('htFlow', 'halftone', 0, 100, 20, 80, { when: hty('etching'), zero: 0.4 }), I('htKinds', 'halftone', 0, 100, 40, 90, { when: hty('etching'), zero: 0.15 }),
  I('htShade', 'halftone', 0, 100, 40, 90, { when: hty('etching'), zero: 0.1 }), I('htHairLong', 'halftone', 0, 100, 40, 90, { when: hty('etching'), zero: 0.1 }),
  ...['htRegSkin', 'htRegHair', 'htRegEyes', 'htRegBrows', 'htRegNose', 'htRegLips', 'htRegCheek'].map((k) => I(k, 'halftone', 0, 100, 20, 80, { when: (n) => hty('etching')(n) && n.htKinds > 0 })),
  I('htWave', 'halftone', 0, 100, 20, 80, { when: hty('engrave') }), I('htWaveLen', 'halftone', 0, 100, 20, 80, { when: hty('engrave') }), I('htGuilloche', 'halftone', 0, 100, 10, 70, { when: hty('engrave'), zero: 0.3 }),
  // ---- colours that belong to the ink (palette target: unticking "palette" freezes every colour)
  C('htColor', 'palette', (r, n, x) => (ink(n) ? { htColor: r() < 0.55 ? '' : inkColor(r, n, x) } : {}), { when: ink }),
  // ---- lines and outline
  C('lineWidth', 'lines', (r, n, x) => linesPatch(r, n, x)),                                                  // also lineScope, lineOffset, lineColor, lineColor2
  // ---- paper margin and print edge: how worn / crooked the edge is follows how hand-made the texture is (grain, roughness, misregistration)
  C('frame', 'frame', (r, n, x) => framePatch(r, n, x)),
  C('lightDir', 'texture', (r, n, x) => ({ lightDir: x.rf() < 0.45 ? 45 : Math.round(x.rf() * 359) })), // direction of shadows and plate offsets (own RNG stream)
  C('hueShift', 'palette', (r, n, x) => ({ hueShift: x.rf() < 0.7 ? 0 : Math.round((x.rf() * 2 - 1) * 70) })), // rotates the whole palette's hue a little
  C('inkfx', 'texture', (r, n, x) => { const q = x.rf, wc = n.mode === 'watercolor', on = q() < (x.bias.inkfx ?? (wc ? 0.8 : 0.22)), mk = () => (q() < 0.7 ? range(q, 10, wc ? 60 : 70) : 0); return on ? { inkStain: mk(), inkSplat: mk(), inkSeed: range(q, 1, 99999) } : { inkStain: 0, inkSplat: 0 }; }), // ink stains / spatter over the whole picture (own RNG stream)
  C('wc', 'texture', (r, n, x) => { const q = x.rf, j = (a, b) => range(q, a, b); return { wcPaper: pick(q, ['hot', 'cold', 'cold', 'tinted']), wcBleed: j(15, 80), wcEdge: j(20, 80), wcGran: j(20, 80), wcLight: j(10, 55), wcHl: j(10, 70), wcBloom: j(10, 70), wcBrush: j(25, 75), wcLayer: j(25, 80), wcMix: j(15, 60), wcLine: pick(q, ['none', 'none', 'etching', 'pen', 'pencil']), wcLineAmt: j(30, 75), wcSat: j(30, 75), wcPcWidth: j(20, 70), wcPcLen: j(25, 75), wcPcAngle: j(0, 180), wcPcFollow: j(20, 80), wcPcParts: j(10, 80), wcPcSat: j(60, 100), wcPcBright: j(60, 95), wcPcPrimary: j(30, 90), wcSeed: range(q, 1, 99999) }; }, { when: (n) => n.mode === 'watercolor' }),
  C('outline', 'lines', (r, n, x) => (n.mode === 'hybrid' ? {} : outlinePatch(r, n, x)), { when: (n) => n.mode !== 'hybrid' }),   // also outlineColor
];
/** Keys the generator fills as a side effect of a custom entry (so the coverage test knows them). */
export const SIDE_KEYS = ['inkStain', 'inkSplat', 'inkSeed', 'wcPaper', 'wcBleed', 'wcEdge', 'wcGran', 'wcLight', 'wcHl', 'wcBloom', 'wcBrush', 'wcLayer', 'wcMix', 'wcLine', 'wcLineAmt', 'wcSat', 'wcPcWidth', 'wcPcLen', 'wcPcAngle', 'wcPcFollow', 'wcPcParts', 'wcPcSat', 'wcPcBright', 'wcPcPrimary', 'wcSeed', 'framePlate', 'framePlateN', 'frameRub', 'frameSplat', 'frameStain', 'frameShift', 'frameSeed', 'frameColor', 'customPreset', 'silColors', 'silSample', 'halftoneType', 'lineScope', 'lineOffset', 'lineColor', 'lineColor2', 'outlineColor'];
/** Look parameters random generation deliberately never draws, with the reason. */
export const EXCLUDED = { background: 'reserved (always "auto")', semStrength: 'only meaningful with the AI engine, which is a device capability', htLayers_etching: 'fixed by the etching renderer' };

const keyOf = (e) => e.k;
export const SPACE_KEYS = new Set([...SPACE.map(keyOf), ...SIDE_KEYS]);

function palList(mode) { return MODE_PRESETS[mode] || MODE_PRESETS.hybrid; }
function palettePatch(r, n, x) {
  const out = {}, mode = n.mode, b = x.bias;
  if (mode === 'silhouette' && r() < 0.15) { out.preset = 'custom'; out.customPreset = null; out.silColors = { bg: randomColor(r, 'vivid'), mid: randomColor(r, 'vivid'), fg: randomColor(r, 'deep') }; out.silSample = false; return out; }
  if (mode === 'silhouette' && r() < 0.2) out.silSample = true;
  if (b.presets) { const ok = b.presets.filter((id) => palList(mode).includes(id)); out.preset = pick(r, ok.length ? ok : palList(mode)); out.customPreset = null; }
  else {
    const u = r();
    if (u < 0.15 && palList(mode).includes('natural')) { out.preset = 'natural'; out.customPreset = null; }
    else if (u < 0.4) { out.preset = pick(r, STYLE_ORDER.filter((id) => palList(mode).includes(id))); out.customPreset = null; }
    else { out.preset = 'random'; out.customPreset = randomPreset(r); }
  }
  if (mode === 'silhouette' && out.silSample !== true) out.silColors = { bg: randomColor(r, 'vivid'), mid: randomColor(r, 'vivid'), fg: randomColor(r, 'deep') };
  return out;
}
const palOf = (n, patchPal) => patchPal || (n.preset === 'random' && n.customPreset ? n.customPreset : PRESETS[n.preset]) || PRESETS.pop;
function inkColor(r, n) {
  const p = palOf(n), g = p.groups; const pool = g ? [p.ink, g.fg.block[0], g.mid.block[0], g.bg.block[0]] : [p.ink];
  const u = r(); return u < 0.65 ? pick(r, pool) : u < 0.85 ? randomColor(r, 'deep') : randomColor(r, 'vivid');
}
function linesPatch(r, n, x) {
  const p = palOf(n), g = p.groups, on = r() < (x.bias.lines ?? 0.4);
  if (!on) return { lineWidth: 0 };
  return { lineWidth: x.win('lineWidth', 10, 45), lineScope: pick(r, ['mid', 'all', 'fg']), lineOffset: r() < 0.5 ? 0 : range(r, 10, 45), lineColor: r() < 0.7 ? p.ink : randomColor(r, 'deep'), lineColor2: g ? pick(r, [g.fg.block[0], g.mid.block[0], g.bg.block[0]]) : randomColor(r, 'vivid') };
}
function framePatch(r0, n, x) {
  const r = x.rf; if (r() >= (x.bias.frame ?? 0.3)) return { frame: 0 };
  const hand = Math.max(0, Math.min(1, (((n.grain ?? 25) + (n.roughness ?? 20) + (n.misreg ?? 25)) / 3) / 60)); // 0 clean machine print .. 1 rough hand-pulled print
  const j = (base, spread) => Math.max(0, Math.min(100, Math.round(base + (r() * 2 - 1) * spread)));
  const fw = x.bias.win && x.bias.win.frame; return { frame: range(r, fw ? fw[0] : 14, fw ? fw[1] : 55), framePlate: j(25 + 55 * hand, 25), framePlateN: 1 + Math.floor(r() * 3), frameRub: j(10 + 60 * hand, 20), frameSplat: r() < 0.55 ? j(15 + 50 * hand, 20) : 0, frameStain: r() < 0.55 ? j(15 + 50 * hand, 20) : 0, frameShift: j(5 + 30 * hand, 15), frameSeed: range(r, 1, 99999), frameColor: '' };
}
function outlinePatch(r, n, x) {
  const p = palOf(n), on = r() < (x.bias.outline ?? 0.3);
  if (!on) return { outline: 0 };
  return { outline: x.win('outline', 8, 45), outlineColor: r() < 0.6 ? p.ink : r() < 0.5 ? p.paper : randomColor(r, 'deep') };
}

/**
 * Draws a patch of look parameters.
 * on: which targets are ticked ({ mode, palette, shape, tone, halftone, texture, background, subject, lines } booleans).
 * rf (optional): random stream for the paper margin (defaults to r).
 * bias: a tendency profile ({ modes, tones, types, ht, bg, presets, lines, outline, angles, win: { key: [lo, hi] }, wild }) or {}.
 */
export function sampleLook(r, cur, on, bias = {}, rf = r) {
  const patch = {}, wild = bias.wild ?? (bias.win ? 0.06 : 0.2);
  const x = { bias, rf, // rf: a separate random stream for the margin, so adding it never changes what the same seed gave before for everything else
     win: (k, lo, hi) => { const w = bias.win && bias.win[k]; return range(r, w ? w[0] : lo, w ? w[1] : hi); } };
  for (const e of SPACE) {
    if (!on[e.target]) continue;
    const next = { ...cur, ...patch };
    if (e.kind === 'custom') { Object.assign(patch, e.gen(r, next, x)); continue; }
    if (e.when && !e.when(next)) continue;
    if (e.kind === 'bool') { patch[e.k] = r() < e.p; continue; }
    if (e.kind === 'enum') { patch[e.k] = e.w ? wpick(r, e.w) : pick(r, e.vals); continue; }
    const [L0, L1] = e.rng ? e.rng(next) : [e.lo, e.hi];
    if (e.zero && r() < e.zero) { patch[e.k] = Math.max(L0, 0); continue; }
    const w = bias.win && bias.win[e.k], full = r() < wild;
    const lo = full ? L0 : Math.max(L0, w ? w[0] : e.plo), hi = full ? L1 : Math.min(L1, w ? w[1] : e.phi);
    patch[e.k] = range(r, Math.min(lo, hi), hi);
  }
  const next = { ...cur, ...patch };
  // consistency after a mode change: the palette must be one this mode offers, a regions picture needs a palette size
  if (patch.mode && patch.mode !== cur.mode) {
    const list = palList(patch.mode), pr = patch.preset ?? cur.preset;
    if (!on.palette && !list.includes(pr) && !(pr === 'random' && next.customPreset) && !(pr === 'custom' && patch.mode === 'silhouette')) patch.preset = list[0];
    if (pr === 'custom' && patch.mode !== 'silhouette') patch.preset = list[0];
    // only the palette size is tied to the mode (0 outside colour regions, at least 2 inside); the other controls keep the values the person set
    if (patch.mode !== 'regions') patch.paletteK = 0; else if (!(next.paletteK >= 2)) patch.paletteK = MODE_DEFAULTS.regions.paletteK;
    if (!('bgTreatment' in patch)) { const p = PRESETS[patch.preset ?? cur.preset]; patch.bgTreatment = p && p.bgTreatment ? p.bgTreatment : 'flat'; }
  }
  // a palette that brings its own background treatment (and no background target): follow it
  if (on.palette && !on.background && (patch.mode ?? cur.mode) === 'hybrid') { const p = palOf({ ...cur, ...patch }); if (p.bgTreatment) patch.bgTreatment = p.bgTreatment; }
  return patch;
}
export { TONES, HT_TYPES };
