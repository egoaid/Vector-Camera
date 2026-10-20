// wc-strokes.js - brush strokes for the watercolour mode (typed-array code, no DOM).
// Paint is kept as optical DENSITY per channel (D = -ln transmittance), so overlapping glazes add up and get darker and more saturated, as real
// transparent washes do; the final colour is paper * exp(-D). Each stroke is a translucent patch of one colour taken from the photo underneath it:
// elongated, with a ragged edge, a darker rim where the pigment pooled, streaks along the brush, and a loaded start / dry end.
// Passes go from broad to small. Strokes are stopped by edges of the photo (a stroke may only run over pixels of its own colour face, or over
// similar colours), and by the gap field (bare paper just inside the boundary of a face).
import { hash } from './tone-photo.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
export const TILE = 512;

/** Small-scale noise that tiles (values 0..1, correlation about 1.5 px): used for ragged edges and bristle streaks. */
export function noiseTile(seed) {
  const A = new Float32Array(TILE * TILE), B = new Float32Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) A[y * TILE + x] = hash(x, y, seed);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const x1 = (x + 1) & (TILE - 1), y1 = (y + 1) & (TILE - 1), v = (A[y * TILE + x] * 2 + A[y * TILE + x1] + A[y1 * TILE + x] + A[y1 * TILE + x1] * 0.5) / 4.5;
    B[y * TILE + x] = Math.max(0, Math.min(1, (v - 0.5) * 2.4 + 0.5));
  }
  return B;
}

// size: stroke half-width relative to the broadest brush; f: share of the photo's density the pass carries; min: layer amount from which it appears
const PASSES = [
  { s: 1.0, f: 0.40, min: 0, asp: 3.3, follow: 0.55, sel: 'all' },
  { s: 0.5, f: 0.30, min: 0, asp: 3.0, follow: 0.8, sel: 'all' },
  { s: 0.3, f: 0.14, min: 0.2, asp: 2.4, follow: 1.2, sel: 'detail' },
  { s: 0.8, f: 0.2, min: 0.5, asp: 3.3, follow: 0.4, sel: 'all', rot: true },
  { s: 0.4, f: 0.14, min: 0.7, asp: 2.6, follow: 0.9, sel: 'dark' },
];

/**
 * c: {tw, th, long, k, lab, ps:[R,G,B] smoothed photo 0..255, Dp:[3] photo density, field, open, D:[3] accumulators, rnd, tile, seed, hand}
 * o: {brush, layer, edge, bleed, hl} all 0..1.
 */
export function paintStrokes(c, o) {
  const { tw, th, long, k, lab, ps, Dp, field, open, D, rnd, tile, seed, hand } = c, M = TILE - 1;
  const hw1 = (0.016 + 0.034 * o.brush) * long, cs = 1.9 + 0.9 * o.hl, soft0 = 0.07 + 0.3 * o.bleed;
  let count = 0;
  for (const P of PASSES) {
    const wgt = P.min === 0 ? 1 : Math.max(0, Math.min(1, (o.layer - P.min) / 0.2)); if (wgt <= 0) continue;
    const hw0 = Math.max(2 * k, hw1 * P.s), cell = hw0 * cs, ovl = (Math.PI * P.asp * 0.9) / (cs * cs), fP = (P.f * wgt) / ovl;
    for (let gy = 0; gy * cell < th; gy++) for (let gx = 0; gx * cell < tw; gx++) {
      const r = new Float32Array(16); for (let q = 0; q < 16; q++) r[q] = rnd();
      const cx = (gx + r[0]) * cell, cy = (gy + r[1]) * cell; if (cx >= tw || cy >= th) continue;
      const ci = (cy | 0) * tw + (cx | 0), home = lab[ci], det = field.det[ci];
      if (P.sel === 'detail' && r[2] > 0.1 + 0.9 * smooth(0.15, 0.6, det)) continue;
      const hw = Math.max(1.6 * k, hw0 * (0.8 + 0.4 * r[4]) * (1 - 0.3 * det)), asp = P.asp * (0.75 + 0.5 * r[3]), hl = hw * asp;
      // direction: along the edges of the photo where there are some, otherwise the hand of the painter with a slow drift
      const nrm = Math.hypot(field.vx[ci], field.vy[ci]) || 1, we = Math.min(1, field.coh[ci] * P.follow * 1.4), base = hand + (r[5] - 0.5) * 1.1 + (P.rot ? (r[6] < 0.5 ? -0.6 : 0.6) : 0);
      const ax = we * (-field.vx[ci] / nrm) + (1 - we) * Math.cos(2 * base), ay = we * (-field.vy[ci] / nrm) + (1 - we) * Math.sin(2 * base), th0 = 0.5 * Math.atan2(ay, ax) + (r[7] - 0.5) * 0.4, cT = Math.cos(th0), sT = Math.sin(th0);
      // colour of the stroke = what the photo has under it (only the pixels of its own face count)
      let s0 = 0, s1 = 0, s2 = 0, p0 = 0, p1 = 0, p2 = 0, sw = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const x = Math.min(tw - 1, Math.max(0, Math.round(cx + a * 0.55 * hl * cT - b * 0.4 * hw * sT))), y = Math.min(th - 1, Math.max(0, Math.round(cy + a * 0.55 * hl * sT + b * 0.4 * hw * cT))), i = y * tw + x, w = lab[i] === home ? 1 : 0.12;
        s0 += Dp[0][i] * w; s1 += Dp[1][i] * w; s2 += Dp[2][i] * w; p0 += ps[0][i] * w; p1 += ps[1][i] * w; p2 += ps[2][i] * w; sw += w;
      }
      s0 /= sw; s1 /= sw; s2 /= sw; p0 /= sw; p1 /= sw; p2 /= sw;
      const meanD = (s0 + s1 + s2) / 3; if (meanD < 0.03) continue; // bare paper stays bare where the photo is white
      if (P.sel === 'dark' && r[2] > smooth(0.3, 1.0, meanD) * 0.85) continue;
      const lj = 0.86 + 0.28 * r[8], d0 = s0 * lj * (0.93 + 0.14 * r[9]), d1 = s1 * lj * (0.93 + 0.14 * r[10]), d2 = s2 * lj * (0.93 + 0.14 * r[11]);
      const taper = 0.05 + 0.4 * r[12], flip = r[13] < 0.5 ? -1 : 1, bend = (r[14] - 0.5) * 0.5, fade = 0.55 * r[15] * r[15] + 0.05, rimV = 0.45 + 0.55 * r[9], soft = soft0 * (0.6 + 0.8 * r[10]) , ox = (r[11] * 997) | 0, oy = (r[12] * 991) | 0, oc = (r[13] * 983) | 0, spill = 0.5, ov = r[14] < 0.12 ? 0.6 : 0;
      const ex = Math.abs(cT) * hl * 1.3 + Math.abs(sT) * hw * 1.3, ey = Math.abs(sT) * hl * 1.3 + Math.abs(cT) * hw * 1.3;
      const x0 = Math.max(0, Math.floor(cx - ex)), x1 = Math.min(tw - 1, Math.ceil(cx + ex)), y0 = Math.max(0, Math.floor(cy - ey)), y1 = Math.min(th - 1, Math.ceil(cy + ey));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy, u = (dx * cT + dy * sT) / hl; if (u > 1.25 || u < -1.25) continue;
        const wf = Math.max(0.35, 1 - taper * smooth(-0.3, 1, u * flip)), v = ((-dx * sT + dy * cT) / hw - bend * u * u) / wf, au = Math.abs(u), av = Math.abs(v); if (av > 1.25) continue;
        const i = y * tw + x, m = Math.cbrt(au * au * au + av * av * av) + (tile[((y + oy) & M) * TILE + ((x + ox) & M)] - 0.5) * 0.06 + (tile[((((y >> 3) + oy) & M) * TILE) + (((x >> 3) + ox) & M)] - 0.5) * 0.15;
        if (m >= 1) continue; const cov = 1 - smooth(1 - soft, 1, m); if (cov <= 0.003) continue;
        let al = 1; if (lab[i] !== home) { const dd = Math.hypot(ps[0][i] - p0, ps[1][i] - p1, ps[2][i] - p2); al = spill * (1 - smooth(14, 46, dd)); if (al <= 0.01) continue; }
        const rim = 1 + 0.6 * o.edge * rimV * smooth(0.55, 0.98, m), along = 1 - fade * (0.5 + 0.5 * u * flip), st = 1 + (tile[((((Math.floor(v * hw / 1.3)) + oc) & M) * TILE) + (((Math.floor(u * hl / 9)) + oy) & M)] - 0.5) * 0.26 * (0.35 + fade);
        const opn = open ? open[i] + (1 - open[i]) * ov : 1, a = cov * rim * along * st * al * opn * fP;
        D[0][i] += a * (d0 * 0.88 + Dp[0][i] * 0.12); D[1][i] += a * (d1 * 0.88 + Dp[1][i] * 0.12); D[2][i] += a * (d2 * 0.88 + Dp[2][i] * 0.12);
      }
      count++;
    }
  }
  return count;
}
