// etching.js - "Etching" ink: hand-drawn looking pen hatching in the manner of Rembrandt's etchings.
// Instead of a threshold screen (which always looks mechanical) the tone image is covered with many separate pen
// strokes. Observations from the etchings this imitates:
//  - tone comes from line DENSITY and from stacking hatch directions, not from fat lines (lines stay hair-thin);
//  - strokes are short-to-medium, slightly bowed, taper at both ends and never quite parallel;
//  - hatches start/stop irregularly where the tone changes, so shading fades out raggedly;
//  - a second and third direction cross the first only in the darks; the deepest darks fill with scribbled marks;
//  - hatch direction follows the form (foliage clumps, folds) while remaining roughly consistent inside a patch.
// Pure typed-array code (no DOM). Deterministic: the same inputs always give the same drawing.
import { mulberry32 } from './color-utils.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
/** Separable box blur (running sums). */
export function boxBlurF(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}

/** Contour-direction field on a coarse grid: for every cell the angle c of the iso-tone line and a 0..1 confidence f. */
function flowField(D, W, H, cell, g) {
  const smoothD = boxBlurF(D, W, H, Math.max(2, Math.round(cell * 2.2))), gw = Math.ceil(W / g), gh = Math.ceil(H / g);
  let xx = new Float32Array(gw * gh), xy = new Float32Array(gw * gh), yy = new Float32Array(gw * gh);
  const at = (x, y) => smoothD[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = Math.min(W - 1, i * g + (g >> 1)), y = Math.min(H - 1, j * g + (g >> 1)), dx = (at(x + g, y) - at(x - g, y)) / (2 * g), dy = (at(x, y + g) - at(x, y - g)) / (2 * g), k = j * gw + i;
    xx[k] = dx * dx; xy[k] = dx * dy; yy[k] = dy * dy;
  }
  const blur3 = (a) => { const o = new Float32Array(a.length); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { let s = 0, n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const ii = i + u, jj = j + v; if (ii >= 0 && jj >= 0 && ii < gw && jj < gh) { s += a[jj * gw + ii]; n++; } } o[j * gw + i] = s / n; } return o; };
  for (let p = 0; p < 3; p++) { xx = blur3(xx); xy = blur3(xy); yy = blur3(yy); }
  const c2 = new Float32Array(gw * gh), s2 = new Float32Array(gw * gh), f = new Float32Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) {
    const a = xx[k] - yy[k], b = 2 * xy[k], mag = Math.sqrt(xx[k] + yy[k]), coh = Math.sqrt(a * a + b * b) / (xx[k] + yy[k] + 1e-9);
    const th = 0.5 * Math.atan2(b, a) + Math.PI / 2; // iso-line = perpendicular to the gradient
    c2[k] = Math.cos(2 * th); s2[k] = Math.sin(2 * th); f[k] = smooth(0.012, 0.09, mag * cell * 3) * (0.35 + 0.65 * coh);
  }
  return { gw, gh, g, c2, s2, f };
}

/**
 * Draws the etching.  D: darkness 0..1 (W*H, already weighted); elig: 1 where ink may be placed (W*H, optional).
 * o: { cell (px), angle (rad), layers 1..4, spread (deg), curve 0..100, sketch 0..100, len 0..100, weight 0..100, seed }.
 * Returns Float32Array coverage 0..1 (W*H).
 */
export function etchMask(D, W, H, elig, o) {
  const cell = Math.max(3, o.cell), mask = new Float32Array(W * H), rnd = mulberry32((o.seed | 0) + 90210);
  const Db = boxBlurF(D, W, H, Math.max(1, Math.round(cell * 0.7))), g = Math.max(3, Math.round(cell * 0.6)), flow = flowField(D, W, H, cell, g);
  const layers = Math.max(1, Math.min(4, Math.round(o.layers || 3))), spread = ((o.spread ?? 60) * Math.PI) / 180, base = o.angle, curve = (o.curve ?? 40) / 100, sk = (o.sketch ?? 40) / 100;
  const lenK = 0.55 + (o.len ?? 50) / 100 * 1.3, wt = 0.7 + ((o.weight ?? 50) / 100) * 0.8, lineW = cell * 0.13 * wt, ds = Math.max(0.7, cell * 0.1);
  const darkAt = (x, y) => Db[Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))];
  const stamp = (x, y, r, a) => {
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(W - 1, Math.ceil(x + r + 1)), y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(H - 1, Math.ceil(y + r + 1)), lim = (r + 1) * (r + 1);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const dx = xx - x, dy = yy - y, d2 = dx * dx + dy * dy; if (d2 > lim) continue; const c = clamp01(r + 0.5 - Math.sqrt(d2)) * a, i = yy * W + xx; if (c > mask[i]) mask[i] = c; }
  };
  // direction at a point for a hatch family rotated by `rot` from the base angle (doubled-angle blend: lines have no sign)
  const ph1 = rnd() * 6.283, ph2 = rnd() * 6.283, ph3 = rnd() * 6.283, patch = (x, y) => 0.34 * Math.sin(x / (cell * 13) + ph1) * Math.cos(y / (cell * 10) + ph2) + 0.2 * Math.sin((x + y) / (cell * 5.5) + ph3); // patches of slightly different hatch angle, as a hand drifts
  const dirAt = (x, y, alpha0, rot) => {
    const alpha = alpha0 + patch(x, y) * (0.4 + 0.8 * sk), k = Math.min(flow.gh - 1, (y / g) | 0) * flow.gw + Math.min(flow.gw - 1, (x / g) | 0), f = flow.f[k] * curve, c2 = flow.c2[k], s2 = flow.s2[k], cr = Math.cos(2 * rot), sr = Math.sin(2 * rot);
    const vx = (1 - f) * Math.cos(2 * alpha) + f * (c2 * cr - s2 * sr), vy = (1 - f) * Math.sin(2 * alpha) + f * (s2 * cr + c2 * sr);
    return { a: 0.5 * Math.atan2(vy, vx), f: flow.f[k] };
  };
  // one hatch family
  const family = (alpha, rot, thr, spacing, strokeLen, rows) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha), diag = Math.hypot(W, H), cx = W / 2, cy = H / 2, half = rows.offset || 0;
    for (let u = -diag / 2 + half * spacing; u < diag / 2; u += spacing * (0.8 + 0.4 * rnd())) {
      let v = -diag / 2 - rnd() * strokeLen;
      while (v < diag / 2) {
        const L = strokeLen * (0.45 + 1.1 * rnd()), uu = u + (rnd() - 0.5) * spacing * 0.55, sx = cx + v * ca - uu * sa, sy = cy + v * sa + uu * ca;
        v += L * (0.55 + 0.7 * rnd()) + rnd() * strokeLen * 0.25;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const i0 = (sy | 0) * W + (sx | 0); if (elig && !elig[i0]) continue;
        const d0 = darkAt(sx, sy); if (rnd() > smooth(thr - 0.06, thr + 0.24, d0) * 0.97) continue;
        // trace the stroke
        const stopTh = thr - 0.1 + (rnd() - 0.5) * 0.12, wob = (0.02 + 0.13 * sk) * (0.5 + rnd()), lam = cell * (10 + 12 * rnd()), ph = rnd() * 6.283, ph2 = rnd() * 6.283, jit = (rnd() - 0.5) * (0.1 + 0.3 * sk), w0 = lineW * (0.75 + 0.6 * rnd()) * (0.8 + 0.5 * d0);
        let x = sx, y = sy, ang = dirAt(x, y, alpha, rot).a, drift = 0, s = 0; const bow = (rnd() - 0.5) * 0.5 * sk; // each stroke is slightly bowed
        const n = Math.max(2, Math.round(L / ds));
        for (let k = 0; k <= n; k++) {
          const tt = k / n, tgt = dirAt(x, y, alpha, rot); let da = tgt.a - ang; da -= Math.PI * Math.round(da / Math.PI); // shortest way, lines are undirected
          ang += da * 0.14; drift += (rnd() - 0.5) * 0.035 * sk; drift *= 0.96;
          const a = ang + jit + wob * (0.6 * Math.sin((s / lam) * 6.283 + ph) + 0.15 * Math.sin((s / (lam * 0.45)) * 6.283 + ph2)) + drift + bow * Math.sin(Math.PI * tt) * 1.3;
          const prof = Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * tt)), 0.55), r = Math.max(0.3, (w0 * prof) / 2);
          stamp(x, y, r, 0.55 + 0.45 * prof);
          x += Math.cos(a) * ds; y += Math.sin(a) * ds; s += ds;
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          if (k > 2 && darkAt(x, y) < stopTh) break; // shading fades out where the tone gets lighter
        }
      }
    }
  };
  const S = cell * 0.62;
  family(base, 0, 0.2, S, cell * 5.5 * lenK, { offset: 0 });
  family(base + 0.05, 0.05, 0.42, S, cell * 4.5 * lenK, { offset: 0.5 }); // fills the gaps of the first family: denser in mid-darks
  if (layers >= 2) family(base + spread, spread, 0.54, S * 1.1, cell * 4 * lenK, { offset: 0.2 });
  if (layers >= 3) family(base - spread * 0.55, -spread * 0.55, 0.68, S * 1.15, cell * 3 * lenK, { offset: 0.7 });
  if (layers >= 4) family(base + spread * 1.7, spread * 1.7, 0.82, S * 0.8, cell * 1.8 * lenK, { offset: 0.35 }); // scribbled marks in the deepest darks
  if (layers >= 3) family(base + spread * 0.3, spread * 0.3, 0.9, S * 0.7, cell * 2.2 * lenK, { offset: 0.15 }); // the very darkest tones close up with short strokes
  return mask;
}
