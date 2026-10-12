// halftone-types.js - threshold fields for the screen types: dot, line, cross-hatch (pen drawing) and engraving (banknote).
// Every type returns s in [0,1]; ink is laid down where the darkness `d` exceeds s, so darker tones thicken lines /
// add hatch layers / swell dots. Pure math (no DOM), shared by the photo ink renderer and the text effects.
//
// opts (all 0..100 unless noted; all optional):
//   weight   overall ink weight (50 = neutral)                     -> used by callers (darkness gain), see htGain()
//   layers   cross-hatch: number of hatch directions (2 or 3)
//   spread   cross-hatch: angle between directions in degrees (20..90)
//   curve    line / cross / engrave: how strongly the lines bend with the form (needs `warp` from the tone image)
//   sketch   cross-hatch: hand-drawn wobble of each pen line
//   wave     engrave: amplitude of the swelling waves
//   waveLen  engrave: wave length
//   guilloche engrave: amount of interlaced lace (guilloche) curves
export const HT_TYPES = ['dot', 'line', 'cross', 'engrave'];
export const HT_DEFAULTS = { htWeight: 50, htLayers: 3, htSpread: 60, htCurve: 40, htSketch: 40, htWave: 50, htWaveLen: 50, htGuilloche: 40 };
/** Extracts the halftone detail options from a params object. */
export const htOptsFrom = (p) => ({ weight: p.htWeight ?? 50, layers: p.htLayers ?? 3, spread: p.htSpread ?? 60, curve: p.htCurve ?? 40, sketch: p.htSketch ?? 40, wave: p.htWave ?? 50, waveLen: p.htWaveLen ?? 50, guilloche: p.htGuilloche ?? 40 });
/** Darkness gain from the weight slider (50 = x1). */
export const htGain = (opts) => 0.45 + ((opts && opts.weight != null ? opts.weight : 50) / 100) * 1.1;

const frac = (v) => v - Math.floor(v);
const tri = (u) => Math.abs(frac(u) - 0.5) * 2; // 0 on a line centre, 1 midway between lines
const hash1 = (n) => { let h = Math.imul(n | 0, 374761393) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const TAU = Math.PI * 2;

/** Builds a fast screen function f(x, y, warp = 0) -> threshold in [0,1]. `warp` = (smoothed tone - 0.5), lets lines follow the form. */
export function makeScreen(type, cell, angleRad, opts = {}) {
  const o = { ...HT_DEFAULTS, weight: 50, layers: 3, spread: 60, curve: 40, sketch: 40, wave: 50, waveLen: 50, guilloche: 40, ...opts };
  const dirs = (a) => [Math.cos(a), Math.sin(a)];
  const [ca, sa] = dirs(angleRad), curve = (o.curve / 100) * 2.2;
  if (type === 'line') return (x, y, w = 0) => tri((x * ca + y * sa) / cell + w * curve);
  if (type === 'cross') {
    const sp = (Math.max(20, Math.min(90, o.spread)) * Math.PI) / 180, [c2, s2] = dirs(angleRad + sp), [c3, s3] = dirs(angleRad - sp), three = o.layers >= 3, sk = (o.sketch / 100) * 0.2;
    // pen lines: every line gets its own small random wobble; later layers only appear in darker tones
    const pen = (u, v, w, id) => { let uu = u + w * curve; if (sk > 0) { const ln = Math.floor(uu), ph = hash1(ln * 31 + id) * TAU; uu += sk * (Math.sin(v / 5.3 + ph) * 0.6 + Math.sin(v / 1.9 + ph * 2) * 0.25) + sk * 0.5 * (hash1(ln * 7 + id) - 0.5); } return tri(uu); };
    return (x, y, w = 0) => {
      const u1 = (x * ca + y * sa) / cell, v1 = (-x * sa + y * ca), u2 = (x * c2 + y * s2) / cell, v2 = (-x * s2 + y * c2), u3 = (x * c3 + y * s3) / cell, v3 = (-x * s3 + y * c3);
      let s = Math.min(pen(u1, v1, w, 1), 0.32 + 0.68 * pen(u2, v2, w, 2));
      if (three) s = Math.min(s, 0.66 + 0.34 * pen(u3, v3, w, 3));
      return s;
    };
  }
  if (type === 'engrave') {
    const amp = 0.15 + (o.wave / 100) * 0.95, len = cell * (6 + (o.waveLen / 100) * 18), g = o.guilloche / 100, [cc, cs] = dirs(angleRad + Math.PI / 2), gl = cell * 22;
    return (x, y, w = 0) => {
      const u = (x * ca + y * sa) / cell, v = -x * sa + y * ca, wv = amp * Math.sin((TAU * v) / len) + amp * 0.38 * Math.sin((TAU * v) / (len * 0.37) + 1.3);
      const uu = u + wv + w * curve, base = tri(uu) * 0.94 + 0.04; // thin highlights drop out
      let s = Math.min(base, 0.8 + 0.2 * tri((x * cc + y * cs) / (cell * 1.7) + 0.5 * Math.sin((TAU * u) / 9)));
      if (g > 0) { // guilloche: two interlaced families of sine curves -> lace / rosette moire
        const A = 1.4 * (0.5 + g), ph = TAU * (v / gl), l1 = tri(u + A * Math.sin(ph)), l2 = tri(u - A * Math.sin(ph) + 0.5);
        s = Math.min(0.999, s * (1 - g) + Math.min(l1, 0.2 + 0.8 * l2) * g * 0.95);
      }
      return s;
    };
  }
  const [cv, sv] = [Math.cos(angleRad), Math.sin(angleRad)];
  return (x, y) => { const u = (x * cv + y * sv) / cell, v = (-x * sv + y * cv) / cell; return 0.5 + 0.25 * (Math.cos(TAU * u) + Math.cos(TAU * v)); };
}
/** One-off threshold (tests / simple callers). */
export function htThreshold(type, x, y, cell, angleRad, opts) { return makeScreen(type, cell, angleRad, opts)(x, y, 0); }
