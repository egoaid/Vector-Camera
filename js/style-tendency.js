// style-tendency.js - "random style tendency": random generation that stays inside a look (etching, silver-gelatin
// photo, silkscreen, pop art), so every result still reads as that kind of picture. Pure functions (no DOM).
// With the tendency off, style-random.js picks fully at random.
import { PRESETS } from './style-palette.js';
const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => Math.round(a + r() * (b - a));

export const TENDENCIES = ['etching', 'silver', 'silkscreen', 'popart'];
/** Random values for the photographic tone controls of the ACTIVE tone mode (silver-gelatin / two-tone); classic -> nothing. All inside the UI ranges. */
export function toneTexturePatch(r, tone) {
  if (tone === 'silver') return { sgBlack: range(r, 0, 22), sgWhite: range(r, 78, 100), sgContrast: range(r, 38, 68), sgCurve: range(r, 38, 72), sgGrain: range(r, 12, 70), sgGrainSize: range(r, 15, 70), sgGrainRough: range(r, 10, 70) };
  if (tone === 'twotone') return { ttThreshold: range(r, 38, 62), ttBias: range(r, 38, 62), ttAdaptive: r() < 0.4 ? range(r, 10, 60) : 0, ttDetail: range(r, 10, 60), ttEdge: r() < 0.5 ? range(r, 10, 50) : 0, ttClean: range(r, 0, 40), ttBreakup: r() < 0.3 ? range(r, 5, 30) : 0 };
  return {};
}

/**
 * Random values for the vector shape controls ("Shape & texture" tab): detail, simplification, angularity, curviness and border smoothing,
 * plus the etching shading controls for eyes, lips and hair. All inside the UI ranges. A tendency narrows the ranges (an etching stays soft and curved, pop art may be sharper).
 */
export function shapePatch(r, tend) {
  const R = { etching: { detail: [30, 55], simplify: [25, 50], ang: [0, 40], fit: [40, 90], sm: [35, 70] }, silver: { detail: [25, 45], simplify: [20, 40], ang: [0, 30], fit: [50, 95], sm: [40, 80] },
    silkscreen: { detail: [28, 60], simplify: [30, 65], ang: [10, 60], fit: [25, 80], sm: [25, 70] }, popart: { detail: [20, 50], simplify: [35, 70], ang: [20, 80], fit: [20, 70], sm: [20, 60] } }[tend] || { detail: [20, 70], simplify: [15, 65], ang: [0, 70], fit: [20, 95], sm: [20, 85] };
  return { detail: range(r, ...R.detail), simplify: range(r, ...R.simplify), angularity: range(r, ...R.ang), curveFit: range(r, ...R.fit), regionSmooth: range(r, ...R.sm), htShade: range(r, 40, 90), htHairLong: range(r, 40, 90) };
}

const PROFILES = {
  etching: {
    palette: (r) => pick(r, ['etching', 'etching', 'etchblue', 'sanguine', 'mono']),
    texture: (r) => ({ separation: 3, retention: range(r, 45, 75), grain: range(r, 0, 15), roughness: range(r, 0, 10), misreg: range(r, 0, 6), paper: range(r, 35, 60), detail: range(r, 30, 48), simplify: range(r, 30, 50),
      halftone: 1, halftoneType: 'etching', halftoneSize: range(r, 5, 8), halftoneAngle: pick(r, [30, 45, 60, range(r, 20, 70)]), htWeight: range(r, 45, 65), htLayers: pick(r, [2, 3, 3, 3, 4]), htSpread: range(r, 45, 80),
      htCurve: range(r, 25, 70), htSketch: range(r, 30, 65), htLen: range(r, 35, 70), htDepth: r() < 0.1 ? 0 : range(r, 30, 80), htContour: r() < 0.1 ? 0 : range(r, 20, 55) }),
    background: (r) => pick(r, ['photo', 'photo', 'paper']),
    subject: (r) => range(r, 20, 45),
    lines: () => ({ lineWidth: 0 }),
  },
  silver: {
    palette: (r) => pick(r, ['silver', 'silver', 'sepia', 'selenium']),
    texture: (r) => { const ht = r() < 0.2; return { separation: 6, retention: range(r, 85, 100), grain: range(r, 35, 75), roughness: range(r, 20, 50), misreg: 0, paper: range(r, 20, 50), detail: range(r, 25, 40), simplify: range(r, 25, 40), tone: 'silver', ...toneTexturePatch(r, 'silver'), sgToning: pick(r, ['none', 'none', 'sepia', 'selenium']), sgToningAmt: range(r, 30, 80), halftone: ht ? 1 : 0, ...(ht ? { halftoneType: 'dot', halftoneSize: range(r, 3, 5), halftoneAngle: pick(r, [15, 45, 75]), htMix: range(r, 25, 55) } : {}) }; },
    background: () => 'photo',
    subject: (r) => range(r, 20, 40),
    lines: () => ({ lineWidth: 0 }),
  },
  silkscreen: {
    palette: (r) => pick(r, ['riso', 'pop', 'garden', 'lovepop', 'boombox', 'stadium', 'lavender', 'skygreen', 'sunhill', 'tealpink', 'unite', 'bluepeach', 'typewriter', 'field']),
    texture: (r) => { const ht = r() < 0.6; return { separation: range(r, 2, 4), retention: range(r, 25, 55), grain: range(r, 20, 50), roughness: range(r, 15, 45), misreg: range(r, 35, 80), paper: range(r, 35, 65), detail: range(r, 32, 48), halftone: ht ? 1 : 0, ...(ht ? { halftoneType: pick(r, ['dot', 'dot', 'line']), halftoneSize: range(r, 4, 8), halftoneAngle: pick(r, [15, 45, 75]) } : {}) }; },
    background: (r) => pick(r, ['flat', 'flat', 'photo']),
    subject: (r) => range(r, 22, 48),
    lines: (r, pal) => (r() < 0.25 ? { lineWidth: range(r, 14, 28), lineScope: pick(r, ['mid', 'all']), lineOffset: range(r, 10, 40), lineColor: pal.ink, lineColor2: pal.groups.fg.block[0] } : { lineWidth: 0 }),
  },
  popart: {
    palette: (r) => pick(r, ['pop', 'pop', 'lovepop', 'royal', 'tealpink', 'stadium', 'lavender', 'riso', 'boombox']),
    texture: (r) => ({ separation: range(r, 2, 3), retention: range(r, 15, 40), grain: range(r, 0, 15), roughness: range(r, 0, 15), misreg: range(r, 0, 20), paper: range(r, 10, 30), detail: range(r, 32, 46), halftone: 1, halftoneType: r() < 0.8 ? 'dot' : 'line', halftoneSize: range(r, 7, 12), halftoneAngle: pick(r, [45, 45, 15, 75]), htWeight: range(r, 50, 70) }),
    background: () => 'flat',
    subject: (r) => range(r, 25, 50),
    lines: (r, pal) => (r() < 0.8 ? { lineWidth: range(r, 22, 45), lineScope: pick(r, ['all', 'mid', 'fg']), lineOffset: 0, lineColor: pal.ink, lineColor2: pal.groups.fg.block[0] } : { lineWidth: 0 }),
  },
};

/**
 * Parameter patch for the chosen tendency. `on` = which parts of the random generation are switched on
 * ({ palette, texture, background, subject, lines }). The mode is always the screen-print (hybrid) mode, because
 * these looks depend on it.
 */
export function tendencyPatch(kind, r, on, cur) {
  const P = PROFILES[kind]; if (!P) return {};
  const patch = { mode: 'hybrid' };
  if (on.palette) { patch.preset = P.palette(r); patch.customPreset = null; }
  if (on.texture) Object.assign(patch, P.texture(r));
  if (on.background) patch.bgTreatment = P.background(r);
  else if (on.palette && PRESETS[patch.preset] && PRESETS[patch.preset].bgTreatment) patch.bgTreatment = PRESETS[patch.preset].bgTreatment;
  if (on.subject) patch.subjectSize = P.subject(r);
  if (on.lines) Object.assign(patch, P.lines(r, PRESETS[patch.preset || cur.preset] || PRESETS.pop));
  return patch;
}
