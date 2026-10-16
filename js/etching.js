// etching.js - "Etching" ink: hand-drawn looking pen hatching in the manner of Rembrandt's etchings.
// Instead of a threshold screen (which always looks mechanical) the tone image is covered with many separate pen
// strokes. Observations from the etchings this imitates:
//  - tone comes from line DENSITY and from stacking hatch directions, not from fat lines (lines stay hair-thin);
//  - strokes are short-to-medium, slightly bowed, taper at both ends and never quite parallel;
//  - hatches start/stop irregularly where the tone changes, so shading fades out raggedly;
//  - a second and third direction cross the first only in the darks; the deepest darks fill with scribbled marks;
//  - hatch direction follows the form (foliage clumps, folds) while remaining roughly consistent inside a patch;
//  - the shapes that matter are drawn as outlines first, stroke by stroke, along the form (contour option), and the
//    shading stops at them; near things are drawn with bolder lines than far things (depth option).
// Pure typed-array code (no DOM). Deterministic: the same inputs always give the same drawing.
import { mulberry32 } from './color-utils.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a || 1e-6)); return t * t * (3 - 2 * t); };
// Touch per kind of thing (see scene-kinds.js): how a draughtsman changes the pen for skin, hair, leaves, sky ...
// len / dens / wt / sk are multipliers (1 = neutral); curve 0..1 = how strongly strokes follow the form (null = keep the user's value);
// ang = fixed hatch direction (radians, 'rand' = every stroke different, 'vert' = upright); maxLayer = highest cross-hatch layer allowed.
const NEUTRAL = { len: 1, dens: 1, wt: 1, sk: 1, curve: null, ang: null, maxLayer: 4 };
export const TOUCH = [
  NEUTRAL,
  { len: 1.3, dens: 0.85, wt: 0.8, sk: 0.8, curve: 1, ang: null, maxLayer: 2 },  // 1 skin: long fine strokes following the form, light cross-hatching
  { len: 1.9, dens: 1.15, wt: 0.9, sk: 0.7, curve: 1, ang: null, maxLayer: 3 },  // 2 hair: long flowing strokes
  { len: 0.4, dens: 1.35, wt: 0.75, sk: 0.4, curve: 0.3, ang: null, maxLayer: 4 }, // 3 eye: short, dense, precise
  { len: 0.55, dens: 1.2, wt: 0.9, sk: 0.4, curve: 0.8, ang: null, maxLayer: 2 }, // 4 brow
  { len: 0.6, dens: 0.9, wt: 0.7, sk: 0.5, curve: 1, ang: null, maxLayer: 2 },    // 5 nose
  { len: 0.5, dens: 1.1, wt: 0.8, sk: 0.4, curve: 1, ang: null, maxLayer: 2 },    // 6 mouth
  { len: 0.7, dens: 0.9, wt: 0.8, sk: 0.7, curve: 1, ang: null, maxLayer: 2 },    // 7 ear
  { len: 2.4, dens: 0.55, wt: 0.7, sk: 0.3, curve: 0, ang: 0, maxLayer: 1 },      // 8 sky: sparse, long, horizontal
  { len: 0.55, dens: 1.15, wt: 1, sk: 1.9, curve: 0.1, ang: 'rand', maxLayer: 4 }, // 9 foliage: short scribbled clumps in every direction
  { len: 0.6, dens: 1, wt: 0.9, sk: 1.2, curve: 0, ang: 'vert', maxLayer: 3 },     // 10 grass: upright flicks
  { len: 2.2, dens: 0.8, wt: 0.8, sk: 0.3, curve: 0, ang: 0, maxLayer: 2 },        // 11 water: long level strokes
  { len: 1.6, dens: 1, wt: 0.85, sk: 0.1, curve: 0, ang: null, maxLayer: 3 },      // 12 structure: straight, ruled lines
];
TOUCH[13] = { len: 2.0, dens: 0.7, wt: 0.75, sk: 0.4, curve: 1, ang: null, maxLayer: 1 }; // 13 cheek (own kind, only set when the cheek control is on): sparse, long, soft strokes that wrap the cheek
/** How strongly each kind's strokes follow the fine image texture (hair strands, brow hairs) when "flow" is on; 1 = as much as the control says. */
export const FLOW_OF = [1, 0.3, 1.5, 0, 1.2, 0.2, 0.5, 0.3, 0, 0.2, 0.2, 0, 0, 0.1];
const LAYER_OF_FAMILY = [1, 1, 2, 3, 4, 3];
const blendAng = (a, t, k) => { const x = (1 - k) * Math.cos(2 * a) + k * Math.cos(2 * t), y = (1 - k) * Math.sin(2 * a) + k * Math.sin(2 * t); return 0.5 * Math.atan2(y, x); };
/** Separable box blur (running sums). */
export function boxBlurF(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}

/** Contour-direction field on a coarse grid: for every cell the angle c of the iso-tone line and a 0..1 confidence f. */
export function flowField(D, W, H, cell, g, fine = false) {
  let smoothD = boxBlurF(D, W, H, fine ? Math.max(1, Math.round(cell * 0.45)) : Math.max(2, Math.round(cell * 2.2))), gw = Math.ceil(W / g), gh = Math.ceil(H / g);
  if (fine) { const lo = boxBlurF(D, W, H, Math.max(3, Math.round(cell * 2.2))); smoothD = smoothD.map((v, k) => v - lo[k]); } // texture = what is left after removing the broad shading (that is the job of the shape-following field)
  let xx = new Float32Array(gw * gh), xy = new Float32Array(gw * gh), yy = new Float32Array(gw * gh);
  const at = (x, y) => smoothD[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = Math.min(W - 1, i * g + (g >> 1)), y = Math.min(H - 1, j * g + (g >> 1)), st = fine ? 1 : g, dx = (at(x + st, y) - at(x - st, y)) / (2 * st), dy = (at(x, y + st) - at(x, y - st)) / (2 * st), k = j * gw + i; // fine texture: 1-px central differences (wider steps distort the direction of fine stripes)
    xx[k] = dx * dx; xy[k] = dx * dy; yy[k] = dy * dy;
  }
  const blur3 = (a) => { const o = new Float32Array(a.length); for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { let s = 0, n = 0; for (let v = -1; v <= 1; v++) for (let u = -1; u <= 1; u++) { const ii = i + u, jj = j + v; if (ii >= 0 && jj >= 0 && ii < gw && jj < gh) { s += a[jj * gw + ii]; n++; } } o[j * gw + i] = s / n; } return o; };
  for (let p = 0; p < (fine ? 2 : 3); p++) { xx = blur3(xx); xy = blur3(xy); yy = blur3(yy); }
  const c2 = new Float32Array(gw * gh), s2 = new Float32Array(gw * gh), f = new Float32Array(gw * gh);
  for (let k = 0; k < gw * gh; k++) {
    const a = xx[k] - yy[k], b = 2 * xy[k], mag = Math.sqrt(xx[k] + yy[k]), coh = Math.sqrt(a * a + b * b) / (xx[k] + yy[k] + 1e-9);
    const th = 0.5 * Math.atan2(b, a) + Math.PI / 2; // iso-line = perpendicular to the gradient
    c2[k] = Math.cos(2 * th); s2[k] = Math.sin(2 * th); f[k] = fine ? smooth(0.02, 0.12, mag * cell * 3) * coh * coh : smooth(0.012, 0.09, mag * cell * 3) * (0.35 + 0.65 * coh); // fine = texture orientation (needs a clearly dominant direction)
  }
  return { gw, gh, g, c2, s2, f };
}

/**
 * Draws the etching.  D: darkness 0..1 (W*H, already weighted); elig: 1 where ink may be placed (W*H, optional).
 * o: { cell (px), angle (rad), layers 1..4, spread (deg), curve 0..100, sketch 0..100, len 0..100, weight 0..100, seed,
 *       contour 0..100 (outline strokes along the form; 0 = off), depth 0..100 (near = bold, far = fine; 0 = uniform),
 *       depthMap (W*H, 0 far .. 1 near; optional) }.
 * Returns Float32Array coverage 0..1 (W*H).
 */
export function etchMask(D, W, H, elig, o) {
  const cell = Math.max(3, o.cell), mask = new Float32Array(W * H), rnd = mulberry32((o.seed | 0) + 90210);
  const Db = boxBlurF(D, W, H, Math.max(1, Math.round(cell * 0.7))), g = Math.max(3, Math.round(cell * 0.6)), flow = flowField(D, W, H, cell, g);
  const layers = Math.max(1, Math.min(4, Math.round(o.layers || 3))), spread = ((o.spread ?? 60) * Math.PI) / 180, base = o.angle, curve = (o.curve ?? 40) / 100, sk = (o.sketch ?? 40) / 100;
  const lenK = 0.55 + (o.len ?? 50) / 100 * 1.3, wt = 0.7 + ((o.weight ?? 50) / 100) * 0.8, lineW = cell * 0.13 * wt, ds = Math.max(0.7, cell * 0.1);
  const dk = Math.max(0, Math.min(1, (o.depth ?? 0) / 100)), dmap = o.depthMap || null;
  const nearAt = (x, y) => (dmap ? dmap[Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))] : 0.5);
  const depthW = (x, y) => (dk > 0 ? Math.max(0.3, Math.min(2.3, 1 + dk * (nearAt(x, y) - 0.5) * 1.8)) : 1); // far lines fine, near lines bold
  const depthA = (x, y) => (dk > 0 ? 1 - 0.3 * dk * (1 - nearAt(x, y)) : 1); // far lines are also a little lighter
  let kmap = o.kindMap || null; if (kmap && o.cheekMap && (o.cheek ?? 0) > 0) { kmap = Uint8Array.from(kmap); for (let i = 0; i < kmap.length; i++) if (o.cheekMap[i] && kmap[i] === 1) kmap[i] = 13; } // cheeks = skin pixels inside the landmark cheek areas
  const kk = kmap ? Math.max(0, Math.min(1, (o.kinds ?? 0) / 100)) : 0, kindAt = (x, y) => (kmap ? kmap[Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))] : 0);
  const regF = o.regions || null, kkOf = (k) => (k === 13 ? Math.min(1.6, kk * (o.cheek ?? 0) / 50) : regF && regF[k] != null ? Math.min(1.6, kk * regF[k]) : kk); // per-region strength of the kind touch (1 = standard)
  const mixT = (k, key) => { const t = TOUCH[k] || NEUTRAL; return key === 'curve' || key === 'ang' || key === 'maxLayer' ? t[key] : 1 + (t[key] - 1) * kkOf(k); };
  const flowK = Math.max(0, Math.min(1, (o.flow ?? 0) / 100)), tex = flowK > 0 ? flowField(D, W, H, cell, Math.max(3, Math.round(cell * 0.6)), true) : null; // flow-following: orientation of the fine texture, independent of the shape-following field
  const cm = new Uint8Array(W * H), amt = Math.max(0, Math.min(1, (o.contour ?? 0) / 100));
  const darkAt = (x, y) => Db[Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))];
  const stamp = (x, y, r, a) => {
    const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(W - 1, Math.ceil(x + r + 1)), y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(H - 1, Math.ceil(y + r + 1)), lim = (r + 1) * (r + 1);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const dx = xx - x, dy = yy - y, d2 = dx * dx + dy * dy; if (d2 > lim) continue; const c = clamp01(r + 0.5 - Math.sqrt(d2)) * a, i = yy * W + xx; if (c > mask[i]) mask[i] = c; }
  };
  // direction at a point for a hatch family rotated by `rot` from the base angle (doubled-angle blend: lines have no sign)
  const ph1 = rnd() * 6.283, ph2 = rnd() * 6.283, ph3 = rnd() * 6.283, patch = (x, y) => 0.34 * Math.sin(x / (cell * 13) + ph1) * Math.cos(y / (cell * 10) + ph2) + 0.2 * Math.sin((x + y) / (cell * 5.5) + ph3); // patches of slightly different hatch angle, as a hand drifts
  const dirAt = (x, y, alpha0, rot, cvK = curve, skK = sk, flK = flowK) => {
    const alpha = alpha0 + patch(x, y) * (0.4 + 0.8 * skK), k = Math.min(flow.gh - 1, (y / g) | 0) * flow.gw + Math.min(flow.gw - 1, (x / g) | 0), f = flow.f[k] * cvK, c2 = flow.c2[k], s2 = flow.s2[k], cr = Math.cos(2 * rot), sr = Math.sin(2 * rot);
    const vx = (1 - f) * Math.cos(2 * alpha) + f * (c2 * cr - s2 * sr), vy = (1 - f) * Math.sin(2 * alpha) + f * (s2 * cr + c2 * sr);
    if (tex && flK > 0) { const kt = Math.min(tex.gh - 1, (y / tex.g) | 0) * tex.gw + Math.min(tex.gw - 1, (x / tex.g) | 0), wf = Math.min(1, flK * tex.f[kt]); if (wf > 0) { const nx = (1 - wf) * vx + wf * (tex.c2[kt] * cr - tex.s2[kt] * sr), ny = (1 - wf) * vy + wf * (tex.s2[kt] * cr + tex.c2[kt] * sr); return { a: 0.5 * Math.atan2(ny, nx), f: flow.f[k] }; } }
    return { a: 0.5 * Math.atan2(vy, vx), f: flow.f[k] };
  };
  // ---- outlines: strokes that follow the form (ridges of the tone gradient), strongest first ----
  function contours() {
    const Gs = boxBlurF(D, W, H, Math.max(1, Math.round(cell * 0.35))), gx = new Float32Array(W * H), gy = new Float32Array(W * H), mg = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, dx = (Gs[i + 1] - Gs[i - 1]) * 0.5, dy = (Gs[i + W] - Gs[i - W]) * 0.5; gx[i] = dx; gy[i] = dy; mg[i] = Math.hypot(dx, dy) * cell; }
    const tc = 0.34 - 0.2 * amt, cand = [], keepP = 0.1 + 0.3 * amt;
    for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
      const i = y * W + x, m = mg[i]; if (m < tc) continue; if (elig && !elig[i]) continue;
      const nx = gx[i] / (m / cell), ny = gy[i] / (m / cell), a = mg[(Math.round(y + ny)) * W + Math.round(x + nx)], b = mg[(Math.round(y - ny)) * W + Math.round(x - nx)];
      if (m >= a && m >= b && rnd() < keepP) cand.push(i);
    }
    cand.sort((p, q) => mg[q] - mg[p]);
    const og = Math.max(2, Math.round(cell * 0.9)), ow = Math.ceil(W / og), occ = new Uint8Array(ow * Math.ceil(H / og)), ds2 = Math.max(1, cell * 0.28), maxLen = cell * (6 + 16 * amt) * (0.6 + 0.5 * lenK), minLen = cell * 3.6;
    const walk = (x, y, sign) => {
      const pts = []; let px = x, py = y, tx = -gy[(y | 0) * W + (x | 0)], ty = gx[(y | 0) * W + (x | 0)], tl = Math.hypot(tx, ty) || 1; tx = (tx / tl) * sign; ty = (ty / tl) * sign; let len = 0, dup = 0;
      while (len < maxLen) {
        px += tx * ds2; py += ty * ds2; len += ds2; if (px < 2 || py < 2 || px >= W - 2 || py >= H - 2) break;
        let i = (py | 0) * W + (px | 0), m = mg[i]; if (m < tc * 0.6) break;
        const nx = gx[i] / (m / cell), ny = gy[i] / (m / cell); let best = 0, bm = m; // re-centre on the ridge
        for (let k = -2; k <= 2; k++) { const j = (Math.round(py + ny * k)) * W + Math.round(px + nx * k); if (mg[j] > bm) { bm = mg[j]; best = k; } }
        px += nx * best * 0.6; py += ny * best * 0.6; i = (py | 0) * W + (px | 0);
        let ntx = -gy[i], nty = gx[i]; const nl = Math.hypot(ntx, nty) || 1; ntx /= nl; nty /= nl; if (ntx * tx + nty * ty < 0) { ntx = -ntx; nty = -nty; }
        if (ntx * tx + nty * ty < 0.62) break; // too sharp a turn: the outline ends here
        tx = tx * 0.55 + ntx * 0.45; ty = ty * 0.55 + nty * 0.45; const tn = Math.hypot(tx, ty) || 1; tx /= tn; ty /= tn;
        const oc = ((py / og) | 0) * ow + ((px / og) | 0); if (occ[oc]) { if (++dup > 5) break; } else dup = 0;
        pts.push(px, py, mg[i]);
      }
      return pts;
    };
    for (const i of cand) {
      const x = i % W, y = (i / W) | 0; if (occ[((y / og) | 0) * ow + ((x / og) | 0)]) continue;
      const fw = walk(x, y, 1), bw = walk(x, y, -1), n = fw.length / 3 + bw.length / 3; if (n * ds2 < minLen) continue;
      const path = []; for (let k = bw.length - 3; k >= 0; k -= 3) path.push(bw[k], bw[k + 1], bw[k + 2]); path.push(x, y, mg[i]); for (let k = 0; k < fw.length; k += 3) path.push(fw[k], fw[k + 1], fw[k + 2]);
      for (let k = 0; k < path.length; k += 3) occ[((path[k + 1] / og) | 0) * ow + ((path[k] / og) | 0)] = 1;
      drawOutline(path, 1, 0);
      if (rnd() < 0.3 * amt) drawOutline(path, 0.7, cell * (0.18 + 0.2 * rnd()) * (rnd() < 0.5 ? -1 : 1)); // the second, slightly displaced pass of a hand-drawn outline
    }
  }
  function drawOutline(path, wk, shift) {
    const np = path.length / 3, ph = rnd() * 6.283, lam = cell * (6 + 8 * rnd()), wob = cell * 0.16 * (0.3 + sk), a0 = 0.9 * wk;
    const i0 = rnd() < 0.5 ? 0 : Math.floor(np * 0.1 * rnd()), i1 = np - (rnd() < 0.5 ? 1 : 1 + Math.floor(np * 0.12 * rnd()));
    let s = 0, gapLeft = 0;
    for (let k = i0; k < i1 - 1; k++) {
      const x0 = path[k * 3], y0 = path[k * 3 + 1], x1 = path[k * 3 + 3], y1 = path[k * 3 + 4], dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1, nrm = Math.min(1.4, path[k * 3 + 2] / 0.6), n = Math.max(1, Math.ceil(dl / 0.7));
      for (let q = 0; q < n; q++) {
        const f = q / n, tt = (k - i0 + f) / Math.max(1, i1 - 1 - i0), x = x0 + dx * f, y = y0 + dy * f; s += dl / n;
        if (gapLeft > 0) { gapLeft -= dl / n; continue; }
        if (rnd() < 0.006 * (1.2 - amt)) { gapLeft = cell * (0.8 + 2 * rnd()); continue; } // breaks in the line
        const off = shift + wob * Math.sin((s / lam) * 6.283 + ph), ox = x + (-dy / dl) * off, oy = y + (dx / dl) * off;
        if (ox < 0 || oy < 0 || ox >= W || oy >= H || (elig && !elig[(oy | 0) * W + (ox | 0)])) continue;
        const prof = Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * tt)), 0.5), r = Math.max(0.35, (lineW * (0.95 + 0.7 * nrm) * wk * depthW(ox, oy) * prof) / 2);
        stamp(ox, oy, r, a0 * depthA(ox, oy) * (0.7 + 0.3 * prof)); cm[(oy | 0) * W + (ox | 0)] = 1;
      }
    }
  }
  // one hatch family
  const family = (alpha, rot, thr, spacing, strokeLen, rows, fi = 0) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha), diag = Math.hypot(W, H), cx = W / 2, cy = H / 2, half = rows.offset || 0;
    for (let u = -diag / 2 + half * spacing; u < diag / 2; u += spacing * (0.8 + 0.4 * rnd())) {
      let v = -diag / 2 - rnd() * strokeLen;
      while (v < diag / 2) {
        const L = strokeLen * (0.45 + 1.1 * rnd()), uu = u + (rnd() - 0.5) * spacing * 0.55, sx = cx + v * ca - uu * sa, sy = cy + v * sa + uu * ca;
        v += L * (0.55 + 0.7 * rnd()) + rnd() * strokeLen * 0.25;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const i0 = (sy | 0) * W + (sx | 0); if (elig && !elig[i0]) continue;
        const kd = kk > 0 ? kindAt(sx, sy) : 0, tp = TOUCH[kd] || NEUTRAL;
        if (kd && LAYER_OF_FAMILY[fi] > tp.maxLayer && rnd() < kkOf(kd)) continue; // e.g. no cross-hatching on skin or sky
        const d0 = Math.min(1, darkAt(sx, sy) * (kd ? mixT(kd, 'dens') : 1)); if (rnd() > smooth(thr - 0.06, thr + 0.24, d0) * 0.97) continue;
        let alphaS = alpha, cvS = curve; const skS = kd ? sk * mixT(kd, 'sk') : sk, Lk = kd ? L * mixT(kd, 'len') : L, wtK = kd ? mixT(kd, 'wt') : 1;
        let flS = flowK; if (kd) { const kq = Math.min(1, kkOf(kd)); flS = flowK * (1 + (FLOW_OF[kd] - 1) * kq); if (tp.curve != null) cvS = Math.max(0, Math.min(1, curve * (1 - kq) + tp.curve * kq)); if (tp.ang != null) { const t = tp.ang === 'rand' ? rnd() * Math.PI : tp.ang === 'vert' ? -Math.PI / 2 + (rnd() - 0.5) * 0.9 : tp.ang + (alpha - base) * 0.25; alphaS = blendAng(alpha, t, kq); } }
        // trace the stroke
        const stopTh = thr - 0.1 + (rnd() - 0.5) * 0.12, wob = (0.02 + 0.13 * skS) * (0.5 + rnd()), lam = cell * (10 + 12 * rnd()), ph = rnd() * 6.283, ph2 = rnd() * 6.283, jit = (rnd() - 0.5) * (0.1 + 0.3 * skS), w0 = lineW * (0.75 + 0.6 * rnd()) * (0.8 + 0.5 * d0) * depthW(sx, sy) * wtK, aD = depthA(sx, sy);
        let x = sx, y = sy, ang = dirAt(x, y, alphaS, rot, cvS, skS, flS).a, drift = 0, s = 0; const bow = (rnd() - 0.5) * 0.5 * skS; // each stroke is slightly bowed
        const n = Math.max(2, Math.round(Lk / ds));
        for (let k = 0; k <= n; k++) {
          const tt = k / n, tgt = dirAt(x, y, alphaS, rot, cvS, skS, flS); let da = tgt.a - ang; da -= Math.PI * Math.round(da / Math.PI); // shortest way, lines are undirected
          ang += da * 0.14; drift += (rnd() - 0.5) * 0.035 * skS; drift *= 0.96;
          const a = ang + jit + wob * (0.6 * Math.sin((s / lam) * 6.283 + ph) + 0.15 * Math.sin((s / (lam * 0.45)) * 6.283 + ph2)) + drift + bow * Math.sin(Math.PI * tt) * 1.3;
          const prof = Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * tt)), 0.55), r = Math.max(0.3, (w0 * prof) / 2);
          stamp(x, y, r, (0.55 + 0.45 * prof) * aD);
          x += Math.cos(a) * ds; y += Math.sin(a) * ds; s += ds;
          if (x < 0 || y < 0 || x >= W || y >= H) break;
          if (k > 2 && darkAt(x, y) < stopTh) break; // shading fades out where the tone gets lighter
          if (elig && !elig[(y | 0) * W + (x | 0)]) break; // never run on past the region
          if (kd && k > 2 && kindAt(x, y) !== kd && rnd() < 0.8 * Math.min(1, kkOf(kd))) break; // a stroke does not run from skin into hair, from an eye onto the cheek ...
          if (amt > 0 && k > 2 && cm[(y | 0) * W + (x | 0)] && rnd() < 0.75) break; // shading stops at the outline
        }
      }
    }
  };
  if (amt > 0) contours();
  if (kk > 0 && amt > 0 && o.strokes) for (const pl of o.strokes) { // outlines of eyes, brows, nose and lips (from face landmarks), drawn like the other outlines
    const path = []; for (let i = 0; i < pl.length; i += 2) path.push(pl[i], pl[i + 1], 0.55);
    if (path.length >= 9) { drawOutline(path, 0.9, 0); if (rnd() < 0.5 * amt) drawOutline(path, 0.6, cell * 0.16 * (rnd() < 0.5 ? -1 : 1)); }
  }
  const S = cell * 0.62;
  family(base, 0, 0.2, S, cell * 5.5 * lenK, { offset: 0 }, 0);
  family(base + 0.05, 0.05, 0.42, S, cell * 4.5 * lenK, { offset: 0.5 }, 1); // fills the gaps of the first family: denser in mid-darks
  if (layers >= 2) family(base + spread, spread, 0.54, S * 1.1, cell * 4 * lenK, { offset: 0.2 }, 2);
  if (layers >= 3) family(base - spread * 0.55, -spread * 0.55, 0.68, S * 1.15, cell * 3 * lenK, { offset: 0.7 }, 3);
  if (layers >= 4) family(base + spread * 1.7, spread * 1.7, 0.82, S * 0.8, cell * 1.8 * lenK, { offset: 0.35 }, 4); // scribbled marks in the deepest darks
  if (layers >= 3) family(base + spread * 0.3, spread * 0.3, 0.9, S * 0.7, cell * 2.2 * lenK, { offset: 0.15 }, 5); // the very darkest tones close up with short strokes
  return mask;
}
