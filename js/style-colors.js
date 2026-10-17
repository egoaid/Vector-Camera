// style-colors.js - random colour generation: harmonious palettes (moods x hue schemes) and single colours. Pure functions (no DOM).
// A generated palette always satisfies the palette contract (valid hex, <= 8 colours per group, ramps of 3) and always has a
// dark ink and a light paper, so the tone / halftone layers drawn with them stay readable.
import { hslToHex, hexToRgb, luma } from './color-utils.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => Math.round(a + r() * (b - a));
const clampL = (v) => Math.max(0, Math.min(100, v));
/** Moods: saturation / lightness windows of the mid-tone colours. */
export const MOODS = { vivid: { s: [65, 95], l: [42, 66] }, pastel: { s: [38, 78], l: [70, 88] }, deep: { s: [45, 85], l: [20, 42] }, earthy: { s: [24, 58], l: [32, 66] }, neon: { s: [88, 100], l: [50, 62] }, soft: { s: [28, 55], l: [55, 78] } };
/** Hue offsets (degrees) of the schemes: complementary, analogous, split, triad, tetrad, one-hue, near-complement. */
export const SCHEMES = [[0, 180], [0, 25, 50], [0, 150, 210], [0, 120, 240], [0, 90, 180, 270], [0, 8, 16], [0, 160, 200, 40]];
/** One random colour of a mood (also used for line / ink / outline colours). */
export function randomColor(r, mood = null) {
  const m = MOODS[mood || pick(r, Object.keys(MOODS))]; return hslToHex(r() * 360, range(r, ...m.s), range(r, ...m.l));
}
const lum = (hex) => luma(...hexToRgb(hex));
/** Harmonious random palette -> a palette object (id 'random'). */
export function randomPreset(r) {
  const moodName = pick(r, Object.keys(MOODS)), m = MOODS[moodName], h0 = r() * 360, scheme = pick(r, SCHEMES);
  const hue = (i) => (h0 + scheme[i % scheme.length] + (r() - 0.5) * 16 + 360) % 360;
  const c = (i, dl = 0) => hslToHex(hue(i), range(r, ...m.s), clampL(range(r, ...m.l) + dl));
  const ink = hslToHex(hue(0), range(r, 20, 70), range(r, 6, 18)), paper = hslToHex(hue(1), range(r, 20, 60), range(r, 90, 96));
  const bgTreatment = pick(r, ['flat', 'flat', 'photo', 'paper']);
  const uniq = (a) => { const o = []; for (const x of a) if (!o.includes(x)) o.push(x); return o; };
  if (r() < 0.55) {
    const bg = uniq([c(0, -4), ...(r() < 0.4 ? [c(2)] : [])]), mid = uniq([c(1), c(2, 6), ...(r() < 0.4 ? [c(3)] : [])]), fg = uniq([c(1, 10), c(3), ...(r() < 0.6 ? [paper] : []), ...(r() < 0.3 ? [c(0, 12)] : [])]);
    return { id: 'random', mode: 'key', ink, paper, bgTreatment, groups: { bg: { block: bg, ink: r() < 0.4 }, mid: { block: mid, ink: r() < 0.9 }, fg: { block: fg, ink: r() < 0.9 } } };
  }
  const ramp = (i) => [hslToHex(hue(i), range(r, 40, 80), range(r, 8, 22)), c(i + 1, -4), hslToHex(hue(i + 2), range(r, 35, 85), range(r, 80, 94))];
  return { id: 'random', mode: 'bands', ink, paper, bgTreatment, groups: { bg: { block: [c(0)], ramp: ramp(0), ink: true }, mid: { block: [c(1)], ramp: ramp(1), ink: true }, fg: { block: [paper], ramp: ramp(2), ink: true } } };
}
export { lum };
