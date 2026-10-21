// wc-lines.js - drawn lines laid over the watercolour (typed-array code, no DOM): the line work that goes with a wash drawing.
//  etching  fine pen hatching in the manner of an etching (etching.js): hairlines that follow the form, crossing in the darks, with a few outlines
//  pen      pen-and-ink drawing: wobbling outlines along the edges of the picture and only a little light hatching in the deepest shadows
//  pencil   coloured pencil: loose, thin, grainy strokes in a darkened version of the colour under them (breaks up on the tooth of the paper)
// Returns an RGBA bitmap to be MULTIPLIED over the painting (colour = the colour of the line, alpha = how much of the pixel the line covers).
import { etchMask, boxBlurF } from './etching.js';
import { hash, vnoise } from './tone-photo.js';
import { hexToRgb } from './color-utils.js';

export const LINE_STYLES = ['none', 'etching', 'pen', 'pencil'];
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };

/** img {w,h,data RGBA}; spec {style, amt 0..100, seed, color '#rrggbb' (optional ink colour)}. -> {w,h,rgba} or null when there is nothing to draw. */
export function wcLineBitmap(img, spec) {
  const style = spec.style, amt = Math.max(0, Math.min(1, (spec.amt ?? 50) / 100)); if (!LINE_STYLES.includes(style) || style === 'none' || !(amt > 0)) return null;
  const W = img.w, H = img.h, N = W * H, long = Math.max(W, H), k = Math.max(1, long / 1000), seed = (spec.seed | 0) + 5;
  const lum = new Float32Array(N), R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++, j += 4) { R[i] = img.data[j]; G[i] = img.data[j + 1]; B[i] = img.data[j + 2]; lum[i] = (0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i]) / 255; }
  const sorted = Array.from(lum.filter((_, i) => i % 11 === 0)).sort((a, b) => a - b), lo = sorted[Math.floor(sorted.length * 0.02)] || 0, hi = sorted[Math.floor(sorted.length * 0.98)] || 1;
  const D = new Float32Array(N); for (let i = 0; i < N; i++) D[i] = Math.max(0, Math.min(1, 1 - (lum[i] - lo) / (hi - lo || 1)));
  let mask, col = null;
  if (style === 'etching') {
    const g = 0.55 + 0.9 * amt, Dg = D.map((v) => Math.min(1, v * g));
    mask = etchMask(Dg, W, H, null, { cell: Math.max(3.5, 4.6 * k), angle: 0.8, layers: 1 + Math.round(2.4 * amt), spread: 60, curve: 65, sketch: 45, len: 55, weight: 30 + 25 * amt, contour: 25 + 55 * amt, depth: 0, seed });
    col = hexToRgb(spec.color || '#2b1f1a');
  } else if (style === 'pen') {
    const Dg = D.map((v) => Math.min(1, v * (0.25 + 0.55 * amt)));
    mask = etchMask(Dg, W, H, null, { cell: Math.max(3.5, 5 * k), angle: 0.9, layers: 1 + (amt > 0.7 ? 1 : 0), spread: 50, curve: 90, sketch: 85, len: 65, weight: 24 + 20 * amt, contour: 45 + 55 * amt, depth: 0, seed });
    col = hexToRgb(spec.color || '#1c1b26');
  } else {
    const Dg = D.map((v) => Math.min(1, v * (0.6 + 0.9 * amt)));
    mask = etchMask(Dg, W, H, null, { cell: Math.max(5, 7.5 * k), angle: 0.7, layers: 1 + Math.round(1.6 * amt), spread: 70, curve: 40, sketch: 90, len: 45, weight: 42 + 30 * amt, contour: 0, depth: 0, seed });
  }
  const rb = Math.max(2, Math.round(4 * k)), pr = style === 'pencil' ? [boxBlurF(R, W, H, rb), boxBlurF(G, W, H, rb), boxBlurF(B, W, H, rb)] : null;
  const rgba = new Uint8ClampedArray(N * 4); let any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let a = mask[i]; if (a < 0.02) continue;
    if (style === 'pencil') { // grain: the pencil only catches the peaks of the paper
      const tooth = hash(x, y, seed + 3) * 0.55 + vnoise(x, y, 1.6 * k, seed + 4) * 0.45; a *= 0.9 * smooth(0.22, 0.6, tooth);
      if (a < 0.02) continue;
      const r = pr[0][i], g = pr[1][i], b = pr[2][i], m = (r + g + b) / 3, s = 1.9, f = 0.7; // darker and a little more colourful than the paint under it
      const j = i * 4; rgba[j] = Math.max(0, Math.min(255, (m + (r - m) * s) * f)); rgba[j + 1] = Math.max(0, Math.min(255, (m + (g - m) * s) * f)); rgba[j + 2] = Math.max(0, Math.min(255, (m + (b - m) * s) * f)); rgba[j + 3] = Math.round(Math.min(1, a) * 255); any = true; continue;
    }
    if (style === 'pen') a = Math.min(1, a * 1.1);
    const j = i * 4; rgba[j] = col[0]; rgba[j + 1] = col[1]; rgba[j + 2] = col[2]; rgba[j + 3] = Math.round(Math.min(1, a * (style === 'etching' ? 0.82 : 0.95)) * 255); any = true;
  }
  return any ? { w: W, h: H, rgba } : null;
}
