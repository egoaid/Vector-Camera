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

/** Direction (cos, sin) a brush would take at pixel i: along the photo's edges where there are some, otherwise the painter's hand. */
export function brushDir(field, i, hand, drift) {
  const nrm = Math.hypot(field.vx[i], field.vy[i]) || 1, we = Math.min(1, field.coh[i] * 1.2), base = hand + drift;
  const ax = we * (-field.vx[i] / nrm) + (1 - we) * Math.cos(2 * base), ay = we * (-field.vy[i] / nrm) + (1 - we) * Math.sin(2 * base), t = 0.5 * Math.atan2(ay, ax);
  return [Math.cos(t), Math.sin(t)];
}

/**
 * Unpainted paper ("reserve"): 1 = paint, 0 = bare paper. The reserve is built from irregular brush-shaped patches (the gaps a hurried brush leaves
 * between its marks, not lines) dropped at random. They are NOT tied to brightness: they land anywhere, in dark places as well as light ones; they are
 * somewhat more likely next to boundaries between faces (where a painter leaves a gap to keep two colours apart), lying along the boundary, and a
 * little more likely in light places. amount 0..1 = how much of the picture is left bare (about 2% .. 22%); brush 0..1 sets the size of the patches.
 */
export function reserveField(lab, ps, dist, contrast, field, tw, th, k, amount, brush, seed, hand, rnd, tile) {
  const N = tw * th, long = Math.max(tw, th); if (amount <= 0) return null;
  const target = (0.02 + 0.2 * amount) * N, nL = contrast.length, rr = new Float32Array(nL), M = 511, open = new Float32Array(N).fill(1), bd = 0.02 * long, base = (0.004 + 0.009 * brush) * long;
  for (let r = 0; r < nL; r++) rr[r] = rnd();
  let covered = 0;
  const stamp = (cx, cy, hw, hl, c, sn, amp) => {
    const taper = 0.1 + 0.5 * rnd(), flip = rnd() < 0.5 ? -1 : 1, bend = (rnd() - 0.5) * 0.8, ox = (rnd() * 997) | 0, oy = (rnd() * 991) | 0, oc = (rnd() * 983) | 0;
    const ex = (Math.abs(c) * hl + Math.abs(sn) * hw) * 1.35, ey = (Math.abs(sn) * hl + Math.abs(c) * hw) * 1.35;
    const x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(tw - 1, Math.ceil(cx + ex)), y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(th - 1, Math.ceil(cy + ey));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, u = (dx * c + dy * sn) / hl; if (u > 1.3 || u < -1.3) continue;
      const wf = Math.max(0.3, 1 - taper * smooth(-0.3, 1, u * flip)), v = ((-dx * sn + dy * c) / hw - bend * u * u) / wf, au = Math.abs(u), av = Math.abs(v); if (av > 1.3) continue;
      const m = Math.pow(au * au * au + av * av * av, 1 / 3) + (tile[((y + oy) & M) * 512 + ((x + ox) & M)] - 0.5) * 0.16 + (tile[((((y >> 3) + oy) & M) * 512) + (((x >> 3) + ox) & M)] - 0.5) * 0.34;
      if (m >= 1) continue;
      // the margin breaks up into streaks along the brush (a dry brush skipping the paper), the middle is bare
      const streak = tile[((((Math.floor(v * hw / 1.3)) + oc) & M) * 512) + (((Math.floor(u * hl / 9)) + oy) & M)], q = amp * Math.max(0, Math.min(1, (1 - smooth(0.45, 1, m) - (1 - streak) * 0.55 * smooth(0.3, 0.9, m)) / 0.45)), i = y * tw + x, prev = 1 - open[i];
      if (q > prev) { covered += q - prev; open[i] = 1 - q; }
    }
  };
  for (let tries = 0; covered < target && tries < 80000; tries++) {
    const cx = rnd() * tw, cy = rnd() * th, ci = (cy | 0) * tw + (cx | 0), l = lab[ci], bnd = Math.exp(-dist[ci] / bd) * (0.4 + 0.6 * smooth(6, 40, contrast[l])), br = (0.299 * ps[0][ci] + 0.587 * ps[1][ci] + 0.114 * ps[2][ci]) / 255;
    if (rnd() > 0.12 + 0.6 * bnd + 0.1 * br + 0.18 * rr[l]) continue;
    const n = 1 + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0), amp = rnd() < 0.6 ? 1 : 0.5 + 0.4 * rnd(); // some patches are only thinly painted, not bare
    for (let j = 0; j < n; j++) {
      const hw = Math.max(1.6 * k, base * Math.exp((rnd() - 0.5) * 1.5)), hl = hw * (2 + 3 * rnd()), [c, sn] = brushDir(field, ci, hand, (rnd() - 0.5) * 1.3), ox = (rnd() - 0.5) * hl * 0.9, oy = (rnd() - 0.5) * hl * 0.9;
      stamp(cx + (j ? ox * c - oy * sn : 0), cy + (j ? ox * sn + oy * c : 0), hw, hl, c, sn, amp);
    }
  }
  return open;
}
