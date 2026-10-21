// wc-lines.js - drawn lines laid over the watercolour (typed-array code, no DOM): the line work that goes with a wash drawing.
//  etching  fine pen hatching in the manner of an etching (etching.js): hairlines that follow the form, crossing in the darks, with a few outlines
//  pen      pen-and-ink drawing: wobbling outlines along the edges of the picture and only a little light hatching in the deepest shadows
//  pencil   coloured pencil (own stroke code): thin grainy strokes in a bright, saturated, near-primary pencil colour chosen from the colour under them;
//           direction, length, width, how much they follow the form of the picture and whether every colour part is hatched on its own are settings
// Returns an RGBA bitmap to be MULTIPLIED over the painting (colour = the colour of the line, alpha = how much of the pixel the line covers).
import { etchMask, boxBlurF } from './etching.js';
import { hash, vnoise } from './tone-photo.js';
import { hexToRgb, mulberry32 } from './color-utils.js';
import { orientationField } from './wc-field.js';

export const LINE_STYLES = ['none', 'etching', 'pen', 'pencil'];
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };

/** img {w,h,data RGBA}; spec {style, amt 0..100, seed, color '#rrggbb' (optional ink colour), pc: pencil settings}; lab: colour-face id per pixel, faceRgb: 3 values per face (pencil only). -> {w,h,rgba} or null when there is nothing to draw. */
export function wcLineBitmap(img, spec, lab, faceRgb) {
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
  } else return pencil(img, spec, amt, { W, H, N, k, seed, R, G, B, lum, D, lab, faceRgb });
  const rgba = new Uint8ClampedArray(N * 4); let any = false;
  for (let i = 0; i < N; i++) {
    let a = mask[i]; if (a < 0.02) continue; if (style === 'pen') a = Math.min(1, a * 1.1);
    const j = i * 4; rgba[j] = col[0]; rgba[j + 1] = col[1]; rgba[j + 2] = col[2]; rgba[j + 3] = Math.round(Math.min(1, a * (style === 'etching' ? 0.82 : 0.95)) * 255); any = true;
  }
  return any ? { w: W, h: H, rgba } : null;
}

const HUES = [0, 28, 52, 120, 195, 225, 275, 320]; // red, orange, yellow, green, light blue, blue, violet, magenta: the pencils of a box
function hsv2rgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, q = Math.floor(((h % 360) + 360) % 360 / 60), r = [c, x, 0, 0, x, c][q], g = [x, c, c, x, 0, 0][q], b = [0, 0, x, c, c, x][q]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
/** The pencil to use for a photo colour: hue pulled toward the nearest primary-ish pencil, strong chroma, light value; greys get a dark blue-grey pencil. */
export function pencilColor(r, g, b, sat, bright, primary) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, s0 = mx ? d / mx : 0, lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  let h = 0; if (d > 0) h = mx === r ? 60 * (((g - b) / d + 6) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  let best = HUES[0], bd = 999; for (const hh of HUES) { const dd = Math.abs(((h - hh + 540) % 360) - 180); if (dd < bd) { bd = dd; best = hh; } }
  const hn = h + (((best - h + 540) % 360) - 180) * primary, chroma = smooth(0.06, 0.28, s0), s1 = Math.min(1, (s0 + (1 - s0) * sat) * 1.0), v1 = 0.5 + 0.5 * bright;
  const col = hsv2rgb(hn, s1, v1 * (0.88 + 0.12 * lum)), grey = [70 + 90 * lum * bright, 74 + 90 * lum * bright, 96 + 80 * lum * bright];
  return [grey[0] + (col[0] - grey[0]) * chroma, grey[1] + (col[1] - grey[1]) * chroma, grey[2] + (col[2] - grey[2]) * chroma];
}

/**
 * Coloured pencil, drawn the way it is used over a wash: a little hatching in the shadows (`shade`) and lines that follow the outlines (`contour`),
 * never a dense fill. Long strokes in broad colour parts, short ones that fit the shape of small parts (`adapt`), with some variation (`vary`).
 */
function pencil(img, spec, amt, c) {
  const { W, H, N, k, seed, R, G, B, D, lab, faceRgb } = c, q = spec.pc || {}, f = (v, d) => Math.max(0, Math.min(100, v ?? d)) / 100;
  const wid0 = (0.3 + 2.7 * f(q.width, 20)) * k, len0 = (12 + 44 * f(q.len, 45)) * k, ang = ((q.angle ?? 40) * Math.PI) / 180, follow = f(q.follow, 50), parts = f(q.parts, 40), sat = f(q.sat, 85), bright = f(q.bright, 80), prim = f(q.primary, 60);
  const adapt = f(q.adapt, 60), vary = f(q.vary, 40), shade = f(q.shade, 55), contour = f(q.contour, 45);
  const rb = Math.max(2, Math.round(3 * k)), Rb = boxBlurF(R, W, H, rb), Gb = boxBlurF(G, W, H, rb), Bb = boxBlurF(B, W, H, rb), Db = boxBlurF(D, W, H, Math.max(2, Math.round(2 * k)));
  const field = orientationField([R, G, B], W, H), rnd = mulberry32((seed * 2654435761) >>> 0), A = new Float32Array(N), C = new Uint8ClampedArray(N * 3);
  const faceAng = (l) => (hash(l, 7, seed) - 0.5) * Math.PI * 0.9;
  let size = null; if (lab) { let nL = 0; for (let i = 0; i < N; i++) if (lab[i] >= nL) nL = lab[i] + 1; const cnt = new Float64Array(nL); for (let i = 0; i < N; i++) cnt[lab[i]]++; size = Float32Array.from(cnt, (n) => Math.max(0.45, Math.min(2.2, Math.sqrt(n / N) / 0.28))); } // 1 = a part about a quarter of the picture wide
  const cs = 5.2 * k * (1.9 - 0.5 * amt), layers = 1 + (amt > 0.6 ? 1 : 0), dens = 0.2 + 0.5 * amt;
  for (let ly = 0; ly < layers; ly++) {
    const rot = ly === 0 ? 0 : ly === 1 ? 0.95 : -0.8, thr = [0.22, 0.5, 0.7][ly];
    for (let gy = 0; gy * cs < H; gy++) for (let gx = 0; gx * cs < W; gx++) {
      const cx = (gx + rnd()) * cs, cy = (gy + rnd()) * cs, r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(); if (cx >= W || cy >= H) continue;
      const ci = (cy | 0) * W + (cx | 0), l = lab ? lab[ci] : 0, edge = field.coh[ci] * (0.4 + 0.6 * field.det[ci]);
      const sp = shade * smooth(thr, thr + 0.4, Db[ci]) * dens, cp = ly === 0 ? contour * smooth(0.12, 0.55, edge) * dens : 0, pt = 1 - (1 - sp) * (1 - cp); if (r1 > pt) continue;
      const isC = r4 < cp / (sp + cp + 1e-9), nrm = Math.hypot(field.vx[ci], field.vy[ci]) || 1, we = isC ? Math.max(0.85, follow) * Math.min(1, field.coh[ci] * 2) : Math.min(1, field.coh[ci] * follow * 1.6), base = ang + (lab ? faceAng(l) * parts : 0) + rot + (r2 - 0.5) * 0.35;
      const ax = we * (-field.vx[ci] / nrm) + (1 - we) * Math.cos(2 * base), ay = we * (-field.vy[ci] / nrm) + (1 - we) * Math.sin(2 * base), th = 0.5 * Math.atan2(ay, ax), cT = Math.cos(th), sT = Math.sin(th);
      const sc = size ? 1 + (size[l] - 1) * adapt : 1, vr = 1 + (r3 - 0.5) * 1.4 * vary, half = len0 * sc * vr * 0.5 * (isC ? 0.8 : 1), bow = (r2 - 0.5) * 0.18, w = wid0 * Math.pow(sc, 0.5) * (1 + (r2 - 0.5) * 0.8 * vary);
      let pr = Rb[ci], pg = Gb[ci], pb = Bb[ci]; if (faceRgb && lab) { pr += (faceRgb[l * 3] - pr) * parts * 0.8; pg += (faceRgb[l * 3 + 1] - pg) * parts * 0.8; pb += (faceRgb[l * 3 + 2] - pb) * parts * 0.8; }
      const pc = pencilColor(pr, pg, pb, sat, bright, prim), lj = 0.94 + 0.12 * rnd();
      const ex = Math.abs(cT) * half + w + 2, ey = Math.abs(sT) * half + w + 2, x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(W - 1, Math.ceil(cx + ex)), y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(H - 1, Math.ceil(cy + ey)), pw = 0.65 + 0.35 * rnd();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, u = dx * cT + dy * sT, v = -dx * sT + dy * cT - bow * u * u / Math.max(1, half) * 2; if (Math.abs(u) > half) continue;
        const i = y * W + x; if (lab && parts > 0.05 && lab[i] !== l && rnd() < parts) continue; // each part is hatched on its own
        const tp = 1 - smooth(0.5, 1, Math.abs(u) / half) * 0.85, e = smooth(w * 0.5 + 0.7, w * 0.5 - 0.15, Math.abs(v)) * tp * pw; if (e <= 0.02) continue;
        if (e > A[i]) { A[i] = e; C[i * 3] = pc[0] * lj; C[i * 3 + 1] = pc[1] * lj; C[i * 3 + 2] = pc[2] * lj; } // (clamped array: 1.06 x 255 must not wrap around)
      }
    }
  }
  const rgba = new Uint8ClampedArray(N * 4); let any = false;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let a = A[i]; if (a < 0.03) continue;
    const tooth = hash(x, y, seed + 3) * 0.55 + vnoise(x, y, 1.6 * k, seed + 4) * 0.45; a *= 0.95 * smooth(0.12, 0.42, tooth); if (a < 0.03) continue;
    const j = i * 4; rgba[j] = C[i * 3]; rgba[j + 1] = C[i * 3 + 1]; rgba[j + 2] = C[i * 3 + 2]; rgba[j + 3] = Math.round(Math.min(1, a) * 255); any = true;
  }
  return any ? { w: W, h: H, rgba } : null;
}
