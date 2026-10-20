// frame-edge.js - the "print edge": what happens where a printed picture meets the blank paper margin of a hand-pulled print.
//  rub:   the picture's edge is worn / dry. The worn spots are NOT painted white: they show exactly what lies underneath (blank paper,
//         or the colour of any misregistered plate that passes there), so plates peek through the scuffed edge.
//  ink:   ink dirt around the plate edges and the picture edge: soft stains with a darker pooled rim (滲み) and spattered droplets with
//         streaky tails (はね), in the colour of the plate (or the picture's ink) they come from.
// Results are RGBA bitmaps in scene units (outer canvas), returned as ink layers so SVG / PDF / vectorising treat them like the other raster ink.
// Pure typed-array code (no DOM) so it runs in Node tests.
import { rasterizeGeom } from './text-fx.js';
import { boxBlur, hash, vnoise } from './tone-photo.js';
import { hexToRgb, mulberry32 } from './color-utils.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
const cache = new Map(), LIMIT = 6;
const polyGeom = (poly) => { const n = poly.length / 2; return { chains: [{ cmds: new Uint8Array(n - 1).fill(2), pts: Float64Array.from(poly) }], loops: [[Int32Array.of(1)]], R: 1 }; };

/**
 * o: { poly (picture clip, outer coords xy...), plates: [{ poly, color }], longUnits, scale (px per unit), rub 0..100, splat 0..100, stain 0..100, seed, paper: hex, ink: hex }
 * -> [layer...]; empty when rub, splat and stain are all 0.
 */
export function frameEdgeLayers(o) {
  if (!(o.rub > 0) && !(o.splat > 0) && !(o.stain > 0)) return [];
  const key = JSON.stringify([Array.from(o.poly, (v) => Math.round(v * 4)), (o.plates || []).map((q) => [q.color, Array.from(q.poly, (v) => Math.round(v * 4))]), Math.round(o.longUnits), +o.scale.toFixed(4), o.rub, o.splat, o.stain, o.seed, o.paper, o.ink]);
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const out = build(o); cache.set(key, out); if (cache.size > LIMIT) cache.delete(cache.keys().next().value); return out;
}
export const clearFrameEdgeCache = () => cache.clear();

function build(o) {
  const long = o.longUnits, rw = Math.max(0, o.rub || 0) / 100, sp = Math.max(0, o.splat || 0) / 100, sn = Math.max(0, o.stain || 0) / 100, seed = (o.seed | 0) + 101, plates = o.plates || [];
  const Rw = (0.003 + 0.013 * rw) * long, reach = (0.01 + 0.05 * Math.max(sp, sn)) * long;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of [o.poly, ...plates.map((q) => q.poly)]) for (let i = 0; i < poly.length; i += 2) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); }
  const pad = Math.max(Rw, (sp > 0 || sn > 0) ? reach : 0) + 3 / o.scale; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  let s = o.scale; const maxDim = 2000; if (Math.max(x1 - x0, y1 - y0) * s > maxDim) s = maxDim / Math.max(x1 - x0, y1 - y0);
  const bbox = [x0, y0, x1, y1], cov = (poly) => rasterizeGeom(polyGeom(poly), [0], bbox, s), m0 = cov(o.poly), W = m0.W, H = m0.H, M = m0.cov, N = W * H;
  const k = Math.max(1, (long * s) / 1000), layers = [], pc = hexToRgb(o.paper);
  const blur2 = (A, r) => boxBlur(boxBlur(A, W, H, Math.max(1, r)), W, H, Math.max(1, r));
  const pm = plates.map((q) => cov(q.poly).cov), pcol = plates.map((q) => hexToRgb(q.color));
  const mkBmp = () => ({ w: W, h: H, rgba: new Uint8ClampedArray(N * 4), gx: x0, gy: y0, gw: W / s, gh: H / s });

  if (rw > 0) { // worn edge: shows what is underneath (paper x every plate passing there), never a flat white
    const B = blur2(M, Math.round(Rw * s * 0.5)), bmp = mkBmp(); let any = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (M[i] <= 0.5) continue; const z = Math.min(1, Math.max(0, (1 - B[i]) / 0.5)); if (z < 0.02) continue;
      const n = vnoise(x, y, 2.4 * k, seed + 1) * 0.5 + vnoise(x, y, 8 * k, seed + 2) * 0.3 + hash(x, y, seed + 3) * 0.2, thr = rw * 1.15 * Math.pow(z, 1.35);
      const a = (1 - smooth(thr - 0.06, thr + 0.06, n)) * 0.97; if (a < 0.02) continue;
      let r = pc[0], g = pc[1], b = pc[2]; for (let q = 0; q < pm.length; q++) if (pm[q][i] > 0.5) { r = r * pcol[q][0] / 255; g = g * pcol[q][1] / 255; b = b * pcol[q][2] / 255; }
      const j = i * 4; bmp.rgba[j] = r; bmp.rgba[j + 1] = g; bmp.rgba[j + 2] = b; bmp.rgba[j + 3] = Math.round(a * 255); any = true;
    }
    if (any) layers.push({ kind: 'ink', name: 'frame-rub', noClip: true, regions: [], bitmap: bmp, blend: 'normal', spec: { mode: 'key', color: o.paper } });
  }

  if (sp > 0 || sn > 0) { // ink dirt: one layer per source colour (plates + the picture's own ink)
    const sources = [...plates.map((q, i) => ({ poly: q.poly, c: pcol[i], hex: q.color, M: pm[i], w: 1 })), { poly: o.poly, c: hexToRgb(o.ink || '#17121c'), hex: o.ink || '#17121c', M, w: 0.55 }];
    const rnd = mulberry32((seed * 2654435761) >>> 0);
    sources.forEach((S, si) => {
      const A = new Float32Array(N); let any = false; const cx = (S.poly.reduce((a, v, i) => a + (i % 2 ? 0 : v), 0)) / (S.poly.length / 2), cy = (S.poly.reduce((a, v, i) => a + (i % 2 ? v : 0), 0)) / (S.poly.length / 2);
      if (sn > 0) { // stains: blotches of ink that wicked into the paper just outside the edge, darker where the ink pooled at the rim
        const P = blur2(S.M, Math.round(reach * s * 0.4));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x; if (S.M[i] > 0.5) continue; const pr = P[i]; if (pr < 0.02) continue;
          const B = vnoise(x, y, 28 * k, seed + 40 + si) * 0.7 + vnoise(x, y, 9 * k, seed + 50 + si) * 0.3, thr = 0.68 - 0.16 * sn;
          const body = smooth(thr, thr + 0.05, B) * smooth(0.02, 0.5, pr), rim = Math.max(0, 1 - Math.abs(B - (thr + 0.03)) / 0.025) * smooth(0.02, 0.4, pr), fib = 0.75 + 0.25 * hash(x, y, seed + 60);
          const a = Math.min(0.85, (body * 0.32 + rim * 0.38) * fib * S.w * (0.4 + 0.6 * sn)); if (a > 0.012) { A[i] = a; any = true; }
        }
      }
      if (sp > 0) { // spatter: droplets thrown off the edge, some with a short streaky tail pointing away from the edge
        const n = Math.round((10 + 150 * sp) * S.w), ps = S.poly, segs = ps.length / 2 - 1;
        for (let d = 0; d < n; d++) {
          const sg = Math.floor(rnd() * segs), t = rnd(), px = ps[sg * 2] + (ps[sg * 2 + 2] - ps[sg * 2]) * t, py = ps[sg * 2 + 1] + (ps[sg * 2 + 3] - ps[sg * 2 + 1]) * t;
          let nx = px - cx, ny = py - cy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; const dist = reach * 0.9 * (-Math.log(1 - rnd() * 0.98)) * (0.3 + 0.7 * sp) * (rnd() < 0.2 ? -0.25 : 1);
          const r = long * (0.0005 + 0.0055 * Math.pow(rnd(), 3.2)) * (0.6 + 0.9 * sp), streak = rnd() < 0.3 ? 1.8 + rnd() * 3 : 1, ang = Math.atan2(ny + (rnd() - 0.5) * 0.6, nx + (rnd() - 0.5) * 0.6), al = 0.55 + 0.4 * rnd();
          const gx = (px + nx * dist - x0) * s, gy = (py + ny * dist - y0) * s, rr = Math.max(0.8, r * s), ex = rr * streak, ca = Math.cos(ang), sa = Math.sin(ang), ext = Math.ceil(Math.max(ex, rr)) + 2;
          for (let yy = Math.max(0, Math.floor(gy - ext)); yy < Math.min(H, Math.ceil(gy + ext)); yy++) for (let xx = Math.max(0, Math.floor(gx - ext)); xx < Math.min(W, Math.ceil(gx + ext)); xx++) {
            const dx = xx + 0.5 - gx, dy = yy + 0.5 - gy, u = (dx * ca + dy * sa) / ex, v = (-dx * sa + dy * ca) / rr, q = Math.sqrt(u * u + v * v); if (q > 1.15) continue;
            const a = al * (1 - smooth(0.78, 1.0, q)) * (streak > 1 ? 1 - 0.55 * Math.max(0, u) : 1); const i = yy * W + xx; if (a > A[i]) { A[i] = a; any = true; }
          }
        }
      }
      if (!any) return; const bmp = mkBmp();
      for (let i = 0; i < N; i++) { const a = A[i]; if (a < 0.012) continue; const j = i * 4; bmp.rgba[j] = S.c[0]; bmp.rgba[j + 1] = S.c[1]; bmp.rgba[j + 2] = S.c[2]; bmp.rgba[j + 3] = Math.round(Math.min(1, a) * 255); }
      layers.push({ kind: 'ink', name: 'frame-ink-' + (si + 1), noClip: true, regions: [], bitmap: bmp, blend: 'multiply', spec: { mode: 'key', color: S.hex } });
    });
  }
  return layers;
}
