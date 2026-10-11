// color-utils.js - sRGB / CIE Lab conversion, k-means, seeded PRNG. Pure, worker-safe.
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const XN = 0.95047, ZN = 1.08883;
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const finv = (t) => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };

export function rgbToLab(r, g, b, out = [0, 0, 0]) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const fx = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / XN);
  const fy = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const fz = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / ZN);
  out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  return out;
}
const gam = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
export function labToRgb(L, a, b, out = [0, 0, 0]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = finv(fx) * XN, y = finv(fy), z = finv(fz) * ZN;
  out[0] = gam(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  out[1] = gam(-0.969266 * x + 1.8760108 * y + 0.041556 * z);
  out[2] = gam(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
  return out;
}
export function rgbaToLabPlanes(rgba, n) {
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  const o = [0, 0, 0];
  for (let i = 0, j = 0; i < n; i++, j += 4) { rgbToLab(rgba[j], rgba[j + 1], rgba[j + 2], o); L[i] = o[0]; A[i] = o[1]; B[i] = o[2]; }
  return { L, A, B };
}
export const hexToRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
export const deltaE = (l1, a1, b1, l2, a2, b2) => Math.hypot(l1 - l2, a1 - a2, b1 - b2);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Weighted k-means in Lab. pts: Float64Array(3n). Deterministic for a given seed. */
export function kmeansLab(pts, wts, n, k, seed = 1, iters = 14) {
  k = Math.max(1, Math.min(k, n));
  const rnd = mulberry32(seed);
  const cen = new Float64Array(3 * k);
  const d2 = new Float64Array(n).fill(Infinity);
  let tw = 0; for (let i = 0; i < n; i++) tw += wts[i];
  let r = rnd() * tw, first = 0;
  for (let i = 0; i < n; i++) { r -= wts[i]; if (r <= 0) { first = i; break; } }
  cen.set(pts.subarray(first * 3, first * 3 + 3), 0);
  for (let c = 1; c < k; c++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 3] - cen[(c - 1) * 3], dy = pts[i * 3 + 1] - cen[(c - 1) * 3 + 1], dz = pts[i * 3 + 2] - cen[(c - 1) * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz; if (d < d2[i]) d2[i] = d; sum += d2[i] * wts[i];
    }
    let t = rnd() * sum, pick = n - 1;
    for (let i = 0; i < n; i++) { t -= d2[i] * wts[i]; if (t <= 0) { pick = i; break; } }
    cen.set(pts.subarray(pick * 3, pick * 3 + 3), c * 3);
  }
  const assign = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dx = pts[i * 3] - cen[c * 3], dy = pts[i * 3 + 1] - cen[c * 3 + 1], dz = pts[i * 3 + 2] - cen[c * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = c; }
      }
      if (assign[i] !== best || it === 0) { assign[i] = best; changed++; }
    }
    const sum = new Float64Array(3 * k), w = new Float64Array(k);
    for (let i = 0; i < n; i++) { const c = assign[i], wt = wts[i]; sum[c * 3] += pts[i * 3] * wt; sum[c * 3 + 1] += pts[i * 3 + 1] * wt; sum[c * 3 + 2] += pts[i * 3 + 2] * wt; w[c] += wt; }
    for (let c = 0; c < k; c++) if (w[c] > 0) { cen[c * 3] = sum[c * 3] / w[c]; cen[c * 3 + 1] = sum[c * 3 + 1] / w[c]; cen[c * 3 + 2] = sum[c * 3 + 2] / w[c]; }
    if (!changed) break;
  }
  return { centers: cen, assign, k };
}
/** h 0..360, s/l 0..100 -> '#rrggbb' */
export function hslToHex(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
