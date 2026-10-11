// style-random.js - seeded randomiser: palette, texture, halftone, background treatment, line overlay and the manual
// foreground/background assignment. Pure functions (no DOM) so they are unit-testable; the app applies the result.
import { mulberry32, hslToHex } from './color-utils.js';
import { PRESETS, STYLE_ORDER } from './style-palette.js';
import { FONTS } from './style-text.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => Math.round(a + r() * (b - a));
const clampL = (v) => Math.max(0, Math.min(100, v));

/** Harmonious random palette -> a preset object (id 'random'). */
export function randomPreset(r) {
  const h0 = r() * 360, scheme = pick(r, [[0, 180], [0, 30, 60], [0, 120, 240], [0, 150, 210], [0, 25, 200], [0, 90, 180, 270]]);
  const hue = (i) => (h0 + scheme[i % scheme.length] + (r() - 0.5) * 14 + 360) % 360;
  const sat = range(r, 55, 92), c = (i, l, s = sat) => hslToHex(hue(i), s, clampL(l));
  const ink = hslToHex(hue(0), range(r, 25, 70), range(r, 8, 20)), paper = hslToHex(hue(1), range(r, 25, 60), range(r, 90, 96));
  const bgTreatment = pick(r, ['flat', 'flat', 'photo', 'paper']);
  const keyMode = r() < 0.62;
  if (keyMode) {
    return { id: 'random', mode: 'key', ink, paper, bgTreatment, groups: {
      bg: { block: [c(0, range(r, 38, 62))], ink: r() < 0.35 },
      mid: { block: [c(1, range(r, 45, 66)), c(2, range(r, 55, 78))], ink: true },
      fg: { block: [c(1, range(r, 62, 82)), c(3, range(r, 55, 75)), paper], ink: true } } };
  }
  const ramp = (i) => [hslToHex(hue(i), range(r, 40, 80), range(r, 10, 22)), c(i + 1, range(r, 38, 58)), hslToHex(hue(i + 2), range(r, 40, 85), range(r, 80, 94))];
  return { id: 'random', mode: 'bands', ink, paper, bgTreatment, groups: {
    bg: { block: [c(0, range(r, 35, 60))], ramp: ramp(0), ink: true }, mid: { block: [c(1, 55)], ramp: ramp(1), ink: true }, fg: { block: [paper], ramp: ramp(2), ink: true } } };
}
/** Picks `n` random pixel positions (area-weighted via region labels) and gives each a different group than it has now. */
export function randomOverrides(r, res, groups, n) {
  const out = [], { w, h, labels } = res;
  for (let k = 0; k < n; k++) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h), cur = groups[labels[y * w + x]];
    out.push({ x, y, g: pick(r, [0, 1, 2].filter((g) => g !== cur)) });
  }
  return out;
}
/**
 * opts: { palette, texture, background, subject, lines } booleans. Returns { params: {...patch}, overrides: [...]|null }.
 * `res`/`groups` are only needed for the foreground/background part.
 */
export function randomize(seed, opts, cur, res = null, groups = null) {
  const r = mulberry32(seed >>> 0), patch = {};
  if (opts.palette) {
    if (r() < 0.25) { patch.preset = pick(r, STYLE_ORDER); patch.customPreset = null; } else { patch.preset = 'random'; patch.customPreset = randomPreset(r); }
    const pr = patch.preset === 'random' ? patch.customPreset : PRESETS[patch.preset]; if (pr && pr.bgTreatment && !opts.background) patch.bgTreatment = pr.bgTreatment;
  }
  if (opts.texture) {
    Object.assign(patch, { separation: range(r, 2, 5), retention: range(r, 20, 80), grain: range(r, 5, 55), roughness: range(r, 0, 45), misreg: range(r, 0, 60), paper: range(r, 10, 60) });
    const ht = r() < 0.45; patch.halftone = ht ? 1 : 0; if (ht) Object.assign(patch, { halftoneSize: range(r, 4, 10), halftoneAngle: pick(r, [15, 45, 75, range(r, 0, 90)]) });
  }
  if (opts.background) patch.bgTreatment = pick(r, ['flat', 'flat', 'photo', 'paper']);
  if (opts.subject) patch.subjectSize = range(r, 14, 52);
  if (opts.lines) {
    if (r() < 0.4) { const pal = patch.customPreset || PRESETS[patch.preset || cur.preset] || PRESETS.pop; patch.lineWidth = range(r, 14, 45); patch.lineScope = pick(r, ['mid', 'all', 'fg']); patch.lineOffset = pick(r, [0, 0, range(r, 10, 45)]); patch.lineColor = pal.ink; patch.lineColor2 = pal.groups.fg.block[0]; }
    else patch.lineWidth = 0;
  }
  if (opts.font) {
    const pal = patch.customPreset || PRESETS[patch.preset || cur.preset] || PRESETS.pop;
    patch.textFont = pick(r, FONTS).id; patch.textColor = pick(r, [pal.paper, pal.groups.fg.block[0], pal.groups.mid.block[0]]); patch.textShadowColor = pal.ink;
    patch.textShadow = pick(r, [0, 15, 25, 40]); patch.textAngle = pick(r, [0, 0, range(r, -12, 12)]); patch.textSpacing = range(r, 0, 8);
  }
  let overrides = null;
  if (opts.subject && res && groups) overrides = r() < 0.3 ? [] : randomOverrides(r, res, groups, range(r, 1, 4));
  return { params: patch, overrides };
}
/** Undo history of {params, overrides} snapshots. */
export class History {
  constructor(max = 30) { this.max = max; this.stack = []; }
  push(snap) { this.stack.push(JSON.parse(JSON.stringify(snap))); if (this.stack.length > this.max) this.stack.shift(); }
  pop() { return this.stack.pop() || null; }
  get size() { return this.stack.length; }
}
