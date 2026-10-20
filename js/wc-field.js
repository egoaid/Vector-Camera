// wc-field.js - analysis maps for the watercolour mode (typed-array code, no DOM):
//  orientationField  which way a brush would travel (follows edges where the photo has them) + how much detail there is
//  boundaryDistance  distance of every pixel to the nearest boundary between two colour faces
//  regionContrast    how different each colour face is from its neighbours
//  gapField          where bare paper is left unpainted: a thin gap just inside the boundary of a colour face, only in places
import { boxBlur, vnoise } from './tone-photo.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
const pct = (A, q) => { const s = []; for (let i = 0; i < A.length; i += 7) s.push(A[i]); s.sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))] || 1e-6; };

/** pr: [R,G,B] Float32Array 0..255. Returns {vx, vy, coh, det}: doubled-angle structure vector (vx,vy), edge strength 0..1 (coh), local detail 0..1 (det). */
export function orientationField(pr, tw, th) {
  const N = tw * th, long = Math.max(tw, th), L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (0.299 * pr[0][i] + 0.587 * pr[1][i] + 0.114 * pr[2][i]) / 255;
  const Lb = boxBlur(L, tw, th, Math.max(1, Math.round(0.004 * long))), gm = new Float32Array(N), jxx = new Float32Array(N), jxy = new Float32Array(N), jyy = new Float32Array(N);
  for (let y = 1; y < th - 1; y++) for (let x = 1; x < tw - 1; x++) {
    const i = y * tw + x, gx = Lb[i + 1] - Lb[i - 1], gy = Lb[i + tw] - Lb[i - tw];
    gm[i] = Math.hypot(gx, gy); jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy;
  }
  const R = Math.max(2, Math.round(0.016 * long)), b2 = (A) => boxBlur(boxBlur(A, tw, th, R), tw, th, R);
  const Axx = b2(jxx), Axy = b2(jxy), Ayy = b2(jyy), vx = new Float32Array(N), vy = new Float32Array(N), coh = new Float32Array(N), tr = new Float32Array(N);
  for (let i = 0; i < N; i++) { vx[i] = Axx[i] - Ayy[i]; vy[i] = 2 * Axy[i]; tr[i] = Axx[i] + Ayy[i]; }
  const t90 = pct(tr, 0.9);
  for (let i = 0; i < N; i++) coh[i] = Math.min(1, Math.hypot(vx[i], vy[i]) / (tr[i] + 1e-9)) * Math.min(1, tr[i] / (0.3 * t90));
  const det = boxBlur(gm, tw, th, Math.max(2, Math.round(0.01 * long))), d90 = pct(det, 0.9);
  for (let i = 0; i < N; i++) det[i] = Math.min(1, det[i] / d90);
  return { vx, vy, coh, det };
}

/** Chamfer distance (px, capped at maxD) to the nearest pixel where the label changes. */
export function boundaryDistance(lab, tw, th, maxD) {
  const N = tw * th, d = new Float32Array(N).fill(maxD);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = y * tw + x; if (x < tw - 1 && lab[i] !== lab[i + 1]) { d[i] = 0; d[i + 1] = 0; } if (y < th - 1 && lab[i] !== lab[i + tw]) { d[i] = 0; d[i + tw] = 0; } }
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) { v = Math.min(v, d[i - tw] + 1); if (x > 0) v = Math.min(v, d[i - tw - 1] + 1.414); if (x < tw - 1) v = Math.min(v, d[i - tw + 1] + 1.414); } d[i] = v;
  }
  for (let y = th - 1; y >= 0; y--) for (let x = tw - 1; x >= 0; x--) {
    const i = y * tw + x; let v = d[i];
    if (x < tw - 1) v = Math.min(v, d[i + 1] + 1); if (y < th - 1) { v = Math.min(v, d[i + tw] + 1); if (x < tw - 1) v = Math.min(v, d[i + tw + 1] + 1.414); if (x > 0) v = Math.min(v, d[i + tw - 1] + 1.414); } d[i] = v;
  }
  return d;
}

/**
 * The face map of the pipeline has stair-stepped, blocky edges. Near every boundary each pixel is given to whichever neighbouring face has the
 * colour closest to the photo at that pixel, so the boundaries follow the photo's own (smooth) colour edges. ps: smoothed photo [R,G,B] 0..255.
 */
export function refineLabels(lab, ps, rgb, tw, th, dist0, reach) {
  const out = Int32Array.from(lab), s = Math.max(2, Math.round(reach / 2));
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x; if (dist0[i] > reach) continue;
    const r = ps[0][i], g = ps[1][i], b = ps[2][i]; let best = lab[i], bd = Infinity;
    for (let dy = -2; dy <= 2; dy++) { const yy = Math.min(th - 1, Math.max(0, y + dy * s)) * tw; for (let dx = -2; dx <= 2; dx++) {
      const l = lab[yy + Math.min(tw - 1, Math.max(0, x + dx * s))], e = (rgb[l * 3] - r) ** 2 + (rgb[l * 3 + 1] - g) ** 2 + (rgb[l * 3 + 2] - b) ** 2, d = l === lab[i] ? e * 0.8 : e;
      if (d < bd) { bd = d; best = l; } } }
    out[i] = best;
  }
  return out;
}

/** Majority filter (radius r) applied only in the band near boundaries: removes the speckle that colour-snapping leaves in textured areas. */
export function modeFilter(lab, tw, th, dist0, reach, r, nLabels) {
  const out = Int32Array.from(lab), cnt = new Uint16Array(nLabels);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x; if (dist0[i] > reach) continue;
    const ya = Math.max(0, y - r), yb = Math.min(th - 1, y + r), xa = Math.max(0, x - r), xb = Math.min(tw - 1, x + r); let best = lab[i], bc = 0;
    for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) cnt[lab[yy * tw + xx]]++;
    for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) { const l = lab[yy * tw + xx]; if (cnt[l] > bc) { bc = cnt[l]; best = l; } }
    for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) cnt[lab[yy * tw + xx]] = 0;
    out[i] = best;
  }
  return out;
}

/** Mean colour difference (RGB distance) between each face and the faces it touches. rgb: 3 values per region. */
export function regionContrast(lab, tw, th, rgb) {
  const R = rgb.length / 3, sum = new Float64Array(R), cnt = new Float64Array(R);
  const pair = (a, b) => { if (a === b) return; const df = Math.hypot(rgb[a * 3] - rgb[b * 3], rgb[a * 3 + 1] - rgb[b * 3 + 1], rgb[a * 3 + 2] - rgb[b * 3 + 2]); sum[a] += df; sum[b] += df; cnt[a]++; cnt[b]++; };
  for (let y = 0; y < th - 1; y++) for (let x = 0; x < tw - 1; x++) { const i = y * tw + x; pair(lab[i], lab[i + 1]); pair(lab[i], lab[i + tw]); }
  const out = new Float32Array(R); for (let r = 0; r < R; r++) out[r] = cnt[r] ? sum[r] / cnt[r] : 0; return out;
}

/**
 * 1 = paint, 0 = bare paper. A gap runs just inside the boundary of a colour face, but only on some faces (rnd), only along some stretches of
 * their boundary (low-frequency noise) and only where the neighbour is a visibly different colour. hl 0..1 sets how wide and how common the gaps are.
 */
export function gapField(lab, dist, contrast, tw, th, k, hl, seed, rnd) {
  const N = tw * th, long = Math.max(tw, th), open = new Float32Array(N).fill(1); if (hl <= 0) return open;
  const R = contrast.length, gk = new Float32Array(R); for (let r = 0; r < R; r++) gk[r] = smooth(16, 60, contrast[r]) * (0.25 + 0.75 * rnd());
  const G = (0.0018 + 0.0075 * hl) * long, e = Math.max(1, 1.3 * k);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x, K = gk[lab[i]]; if (K < 0.02) continue; const d = dist[i]; if (d > G * 1.1 + 3 * e) continue;
    const rho = K * smooth(0.5, 0.8, vnoise(x, y, 0.08 * long, seed)) * (0.45 + 0.55 * smooth(0.2, 0.8, vnoise(x, y, 0.02 * long, seed + 1))), w = G * rho; if (w < 0.4) continue;
    open[i] = smooth(w - e, w + 0.6 * e, d + (vnoise(x, y, 0.006 * long, seed + 2) - 0.5) * e * 1.1);
  }
  return open;
}
