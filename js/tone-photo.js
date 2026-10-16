// tone-photo.js - photographic tonal treatment for the hybrid ink: SILVER-GELATIN (continuous grayscale, film grain, tonal
// curve, optional toning) and MONOCHROME TWO-TONE (strict threshold with its own controls). Pure typed-array code (no DOM).
//
// PROCESSING ORDER (fixed; render-ink.js calls the stages in exactly this order, tests/tone.test.mjs checks the invariants):
//   0. luminance is normalised to the 2..98 percentile range of the regions (render-ink)
//   silver  : black / white point -> overall contrast -> midtone curve -> film grain -> halftone overlay -> colour ramp (toning is part of the ramp)
//   twotone : noise clean-up -> detail boost -> tonal bias -> edge darkening -> (adaptive) threshold + breakup -> halftone overlay moves the threshold -> two colours
// Film grain is photographic and sits BEFORE the halftone screen (which is a printing step); the halftone never changes the tonal mapping.
import { hexToRgb, rgbToHex } from './color-utils.js';

export function hash(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, cell, s) {
  const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Separable box blur of a Float32/Float64 tone image (running sums). */
export function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v), S = (t) => t * t * (3 - 2 * t);

export const TONES = ['classic', 'silver', 'twotone'];
export const TONINGS = ['none', 'sepia', 'selenium'];
/** Neutral defaults: with tone = 'classic' none of these has any effect, so styles saved before v0.9 render as before. */
export const TONE_DEFAULTS = { tone: 'classic', sgBlack: 0, sgWhite: 100, sgContrast: 50, sgCurve: 50, sgGrain: 35, sgGrainSize: 40, sgGrainRough: 40, sgToning: 'none', sgToningAmt: 60,
  ttThreshold: 50, ttBias: 50, ttAdaptive: 0, ttDetail: 30, ttEdge: 0, ttClean: 20, ttBreakup: 0, ttStrict: true, htMix: 70 };
export const sgOptsFrom = (p) => ({ black: p.sgBlack ?? 0, white: p.sgWhite ?? 100, contrast: p.sgContrast ?? 50, curve: p.sgCurve ?? 50, grain: p.sgGrain ?? 35, grainSize: p.sgGrainSize ?? 40, rough: p.sgGrainRough ?? 40, toning: p.sgToning || 'none', toningAmt: p.sgToningAmt ?? 60 });
export const ttOptsFrom = (p) => ({ threshold: p.ttThreshold ?? 50, bias: p.ttBias ?? 50, adaptive: p.ttAdaptive ?? 0, detail: p.ttDetail ?? 30, edge: p.ttEdge ?? 0, clean: p.ttClean ?? 20, breakup: p.ttBreakup ?? 0, strict: p.ttStrict !== false });

/* ---------------- silver-gelatin ---------------- */
/** Tone curve of one normalised tone t (0 dark .. 1 light): black / white point, overall contrast, midtone S-curve. */
export function silverTone(t, o) {
  const bp = o.black * 0.004, wp = 1 - (100 - o.white) * 0.004; // black point 0..0.4 (deeper shadows), white point 1..0.6 (100 = highlights fully kept)
  let v = clamp01((t - bp) / Math.max(0.05, wp - bp));
  const c = (o.contrast - 50) / 50; if (c !== 0) v = clamp01(0.5 + (v - 0.5) * (1 + (c > 0 ? 2.2 * c : 0.8 * c)));
  const s = (o.curve - 50) / 50; if (s !== 0) v = v + (S(v) - v) * s; // s > 0: S-curve (punchier mids), s < 0: flatter mids
  return clamp01(v);
}
/** Film grain: size, intensity and roughness (clumping + rare heavy crystals); strongest in the midtones, deterministic. `scale` = px per 900 px of width. */
export function silverGrain(v, gx, gy, o, scale = 1) {
  const g = o.grain / 100; if (g <= 0) return v;
  const gs = Math.max(1, (0.7 + (o.grainSize / 100) * 3.3) * scale), r = o.rough / 100;
  const fine = vnoise(gx, gy, gs, 21) - 0.5, clump = vnoise(gx, gy, gs * 4, 22) - 0.5;
  let n = fine * (1 - 0.5 * r) + clump * 0.9 * r;
  if (r > 0 && hash(gx, gy, 23) > 0.985) n += (hash(gx, gy, 24) < 0.5 ? -1 : 1) * 0.35 * r;
  return v + n * g * 0.8 * (0.35 + 0.65 * 4 * v * (1 - v));
}
const TONERS = { sepia: ['#1a110a', '#7a5a3c', '#e6d2b0'], selenium: ['#0b0e14', '#5d6672', '#dfe4ea'] };
const at = (stops, f) => { const n = stops.length - 1, x = clamp01(f) * n, i = Math.min(n - 1, Math.floor(x)), u = x - i, a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
/** Colour ramp of a silver-gelatin print: the palette's ramp (hex[]) mixed toward sepia / selenium by `amt` (0..100). Same colour space as the rest of the pipeline (sRGB). */
export function tonedRamp(ramp, toning, amt) {
  if (!TONERS[toning] || !(amt > 0)) return ramp; const T = TONERS[toning].map(hexToRgb), a = Math.min(1, amt / 100), n = ramp.length - 1;
  return ramp.map((hx, i) => { const c = hexToRgb(hx), t = at(T, n ? i / n : 0); return rgbToHex(c[0] + (t[0] - c[0]) * a, c[1] + (t[1] - c[1]) * a, c[2] + (t[2] - c[2]) * a); });
}
/** Neutral 3-stop ramp (ink -> mid -> paper) for palettes that have no tone ramp of their own. */
export function neutralRamp(ink, paper) { const a = hexToRgb(ink), b = hexToRgb(paper); return [ink, rgbToHex(a[0] + (b[0] - a[0]) * 0.45, a[1] + (b[1] - a[1]) * 0.45, a[2] + (b[2] - a[2]) * 0.45), paper]; }

/* ---------------- monochrome two-tone ---------------- */
/**
 * Pre-processing of the two-tone image for a W x H crop (T = normalised tone, 1 = light). `scale` = tw / 640 (px per 640 px of width),
 * (x0, y0) = crop origin in the full raster (for deterministic noise). Returns { t, thr }: final tone and per-pixel threshold (ink where t < thr).
 */
export function prepTwoTone(T, W, H, scale, o, x0 = 0, y0 = 0) {
  let t = T; const n = W * H;
  const rc = Math.round((o.clean / 100) * 2.5 * scale); if (rc > 0) t = boxBlur(t, W, H, rc); // noise clean-up: specks vanish before the threshold
  if (o.detail > 0) { const rd = Math.max(1, Math.round(2 * scale)), bl = boxBlur(t, W, H, rd), a = (o.detail / 100) * 1.6, u = new Float32Array(n); for (let i = 0; i < n; i++) u[i] = clamp01(t[i] + a * (t[i] - bl[i])); t = u; } // fine-detail preservation (unsharp mask)
  if (o.bias !== 50) { const gam = Math.pow(2, (o.bias - 50) / 25), u = new Float32Array(n); for (let i = 0; i < n; i++) u[i] = Math.pow(t[i], gam); t = u; } // tonal bias: > 50 = more black
  if (o.edge > 0) { // edge preservation: strong tone steps are pulled toward ink so outlines survive the threshold
    const e = (o.edge / 100) * 0.55, u = new Float32Array(n), g = (x, y) => t[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1), sy = g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1) - g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1);
      u[y * W + x] = clamp01(t[y * W + x] - e * clamp01(Math.hypot(sx, sy) * 0.75));
    }
    t = u;
  }
  if (o.breakup > 0) { const a = (o.breakup / 100) * 0.5, u = new Float32Array(n); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) u[y * W + x] = t[y * W + x] + (hash(x + x0, y + y0, 31) - 0.5) * a; t = u; } // controlled breakup: dither noise before the threshold
  const T0 = o.threshold / 100, A = o.adaptive / 100, thr = new Float32Array(n);
  if (A > 0) { const m = boxBlur(t, W, H, Math.max(4, Math.round(0.05 * Math.max(W, H)))); for (let i = 0; i < n; i++) thr[i] = (1 - A) * T0 + A * (m[i] - 0.08 + (T0 - 0.5)); } // local threshold follows the neighbourhood mean
  else thr.fill(T0);
  return { t, thr };
}
