// style-macro.js - "linked mode" for random generation: three hidden macro axes (roughness / fineness / boldness) pull many
// parameters in the same direction, so the combination reads as one coherent print instead of independent dice.
// Opt-in (random option "link"); the plain sampler is untouched. Own RNG stream, so the axes never disturb other draws.
import { mulberry32 } from './color-utils.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** key -> [axis, value at axis=0, value at axis=100, weight of the pull]. */
export const MACRO_MAP = {
  grain: ['rough', 0, 70, 0.6], roughness: ['rough', 0, 60, 0.6], misreg: ['rough', 0, 80, 0.55], frameBleed: ['rough', 5, 85, 0.6], frameRub: ['rough', 5, 85, 0.6], frameShift: ['rough', 5, 75, 0.5], textWear: ['rough', 0, 70, 0.4],
  detail: ['fine', 22, 75, 0.55], simplify: ['fine', 60, 12, 0.55], separation: ['fine', 2, 6, 0.4], halftoneSize: ['fine', 12, 3, 0.5], htLayers: ['fine', 1, 4, 0.3],
  retention: ['bold', 25, 85, 0.45], outline: ['bold', 0, 40, 0.4], lineWidth: ['bold', 20, 70, 0.4], angularity: ['bold', 15, 70, 0.4], htWeight: ['bold', 20, 85, 0.4], textShadow: ['bold', 0, 40, 0.3],
};
export function macroAxes(seed) { const r = mulberry32(((seed >>> 0) ^ 0x85ebca6b) >>> 0); return { rough: Math.round(r() * 100), fine: Math.round(r() * 100), bold: Math.round(r() * 100), noise: r }; }
/** Pulls the numeric values in `patch` (falling back to `cur`) towards the axis targets; integer results, clamped. Returns the axes used. */
export function applyMacro(patch, cur, seed) {
  const ax = macroAxes(seed), r = ax.noise;
  for (const [k, [axis, v0, v1, w]] of Object.entries(MACRO_MAP)) {
    const old = k in patch ? patch[k] : cur[k]; if (typeof old !== 'number') continue;
    const tgt = v0 + (v1 - v0) * (ax[axis] / 100), n = (r() * 2 - 1) * 0.08 * Math.abs(v1 - v0);
    if (old === 0 && k !== 'grain' && k !== 'roughness' && k !== 'misreg') continue; // keep "off" for optional effects
    const lo = Math.min(v0, v1), hi = Math.max(v0, v1); patch[k] = Math.round(clamp(old * (1 - w) + tgt * w + n, Math.min(lo, old), Math.max(hi, old)));
  }
  return { rough: ax.rough, fine: ax.fine, bold: ax.bold };
}
