// style-macro.js - "linked mode" (modulation matrix) for random generation.
// Like a modular synth: a few modulation SOURCES (M1..M6, random values per press) are patched into DESTINATION groups of parameters through a
// matrix of signed amounts. Every parameter also gets its own hash-derived "cable" jitter, so no two parameters move alike, and a second pass
// lets parameters modulate each other (cross-modulation). Nothing is classified or "aligned": the result is a deterministic but surprising
// web of couplings. Opt-in (random option "link"); the plain sampler is untouched. Own RNG streams, so no other draw is disturbed.
import { mulberry32 } from './color-utils.js';

export const SOURCES = 6;
/** Destination groups and the parameters in each: [key, lo, hi, circular?]. */
export const DEST_GROUPS = [
  { id: 'shape', keys: [['detail', 10, 90], ['simplify', 5, 80], ['angularity', 0, 90], ['curveFit', 10, 95], ['regionSmooth', 0, 90]] },
  { id: 'tone', keys: [['separation', 2, 6], ['retention', 10, 95], ['paper', 0, 80]] },
  { id: 'texture', keys: [['grain', 0, 90], ['roughness', 0, 80]] },
  { id: 'plate', keys: [['misreg', 0, 90], ['lineOffset', 0, 80], ['framePlate', 0, 100], ['frameShift', 0, 60]] },
  { id: 'dots', keys: [['halftoneSize', 3, 14], ['halftoneAngle', 0, 90], ['htWeight', 10, 95]] },
  { id: 'line', keys: [['lineWidth', 5, 80], ['outline', 5, 50], ['frameRub', 0, 100]] },
  { id: 'light', keys: [['lightDir', 0, 359, true], ['hueShift', -90, 90], ['textShadow', 0, 50]] },
];
export const GROUPS = DEST_GROUPS.length, CELLS = SOURCES * GROUPS;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// deterministic hash -> [0,1)
const h01 = (a, b, c) => { let x = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; x = Math.imul(x, 0x297a2d39) >>> 0; x ^= x >>> 15; return (x >>> 0) / 4294967296; };

/** Random matrix: SOURCES x GROUPS cells in -100..100 (about 55% patched, the rest 0). Index = source * GROUPS + group. */
export function randomMatrix(seed) {
  const r = mulberry32(((seed >>> 0) ^ 0xc2b2ae35) >>> 0), m = [];
  for (let i = 0; i < CELLS; i++) m.push(r() < 0.55 ? Math.round((r() * 2 - 1) * 100) : 0);
  return m;
}
export const parseMatrix = (s) => { const a = String(s || '').split(',').map(Number); return a.length === CELLS && a.every(Number.isFinite) ? a.map((v) => Math.max(-100, Math.min(100, Math.round(v)))) : null; };
export const matrixToString = (m) => m.join(',');

/**
 * Modulates the numeric values already sampled in `patch` (only keys the random run is allowed to touch, and only effects that are "on").
 * cfg: { depth 0..100 (how far sources move values), cross 0..100 (parameter-to-parameter modulation), matrix: number[] | null (null = random per press) }.
 * Returns { matrix, sources } for display.
 */
export function applyMacro(patch, cur, seed, cfg = {}) {
  const depth = (cfg.depth ?? 60) / 100, cross = (cfg.cross ?? 35) / 100, sd = (seed >>> 0) | 0;
  const matrix = cfg.matrix && cfg.matrix.length === CELLS ? cfg.matrix : randomMatrix(seed), rs = mulberry32(((seed >>> 0) ^ 0x85ebca6b) >>> 0);
  const sources = Array.from({ length: SOURCES }, () => rs() * 2 - 1);
  const items = [];
  DEST_GROUPS.forEach((g, gi) => g.keys.forEach(([k, lo, hi, circ], ki) => {
    if (typeof patch[k] !== 'number') return;
    if (patch[k] === 0 && !['grain', 'roughness', 'misreg', 'hueShift'].includes(k)) return; // an effect that is off stays off
    if (k.startsWith('frame') && k !== 'frame' && !(patch.frame > 0 || (!('frame' in patch) && cur.frame > 0))) return;
    items.push({ k, lo, hi, circ, gi, id: gi * 16 + ki, v: circ ? ((patch[k] % 360) + 360) % 360 / 360 : clamp01((patch[k] - lo) / (hi - lo)) });
  }));
  // pass 1: sources -> parameters through the matrix; each cable has its own gain and polarity
  const d1 = items.map((it) => { let d = 0; for (let s = 0; s < SOURCES; s++) { const amt = matrix[s * GROUPS + it.gi] / 100; if (!amt) continue; const gain = (0.35 + 0.9 * h01(sd, it.id, s)) * (h01(sd, it.id, s + 40) < 0.25 ? -1 : 1); d += sources[s] * amt * gain; } return d; });
  const v1 = items.map((it, i) => clamp01(it.v + depth * 0.55 * d1[i]));
  // pass 2: parameters modulate each other (sparse random cross cables, values taken from pass 1)
  const v2 = items.map((it, i) => { let d = 0; items.forEach((jt, j) => { if (j === i) return; if (h01(sd + 7, it.id, jt.id) > 0.22) return; d += (h01(sd + 9, it.id, jt.id) * 2 - 1) * (v1[j] - 0.5) * 2; }); return clamp01(v1[i] + cross * 0.35 * d); });
  items.forEach((it, i) => { patch[it.k] = it.circ ? Math.round(v2[i] * 360) % 360 : Math.round(it.lo + v2[i] * (it.hi - it.lo)); });
  return { matrix, sources };
}
