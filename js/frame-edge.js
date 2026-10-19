// frame-edge.js - the "print edge": what happens where a printed picture meets the blank paper margin of a hand-pulled print.
//  rub:   the picture's edge is worn / dry - paper-coloured speckle eats into the picture, densest right at the edge
// The result is an RGBA bitmap in scene units (outer canvas), returned as ink layers so SVG / PDF / vectorising treat them like the other raster ink.
// Pure typed-array code (no DOM) so it runs in Node tests.
import { rasterizeGeom } from './text-fx.js';
import { boxBlur, hash, vnoise } from './tone-photo.js';
import { hexToRgb } from './color-utils.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
const cache = new Map(), LIMIT = 6;
const polyGeom = (poly) => { const n = poly.length / 2; return { chains: [{ cmds: new Uint8Array(n - 1).fill(2), pts: Float64Array.from(poly) }], loops: [[Int32Array.of(1)]], R: 1 }; };

/**
 * o: { poly (outer coords, xy...), longUnits, scale (px per unit), rub 0..100, seed, paper: hex }
 * -> [layer...]; empty when rub is 0.
 */
export function frameEdgeLayers(o) {
  if (!(o.rub > 0)) return [];
  const key = JSON.stringify([Array.from(o.poly, (v) => Math.round(v * 4)), Math.round(o.longUnits), +o.scale.toFixed(4), o.rub, o.seed, o.paper]);
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const out = build(o); cache.set(key, out); if (cache.size > LIMIT) cache.delete(cache.keys().next().value); return out;
}
export const clearFrameEdgeCache = () => cache.clear();

function build(o) {
  const long = o.longUnits, rw = Math.max(0, o.rub) / 100, seed = (o.seed | 0) + 101;
  const Rw = (0.003 + 0.013 * rw) * long;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < o.poly.length; i += 2) { x0 = Math.min(x0, o.poly[i]); x1 = Math.max(x1, o.poly[i]); y0 = Math.min(y0, o.poly[i + 1]); y1 = Math.max(y1, o.poly[i + 1]); }
  const pad = Rw + 3 / o.scale; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  let s = o.scale; const maxDim = 2400; if (Math.max(x1 - x0, y1 - y0) * s > maxDim) s = maxDim / Math.max(x1 - x0, y1 - y0);
  const m = rasterizeGeom(polyGeom(o.poly), [0], [x0, y0, x1, y1], s), W = m.W, H = m.H, M = m.cov, N = W * H;
  const k = Math.max(1, (long * s) / 1000), at = (px, py) => [x0 + (px + 0.5) / s, y0 + (py + 0.5) / s];
  const mk = (blend, color) => ({ w: W, h: H, rgba: new Uint8ClampedArray(N * 4), gx: x0, gy: y0, gw: W / s, gh: H / s });
  const layers = [];
  const blur2 = (r) => boxBlur(boxBlur(M, W, H, Math.max(1, r)), W, H, Math.max(1, r));
  if (rw > 0) {
    const B = blur2(Math.round(Rw * s * 0.5)), bmp = mk(), pc = hexToRgb(o.paper); let any = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (M[i] <= 0.5) continue; const z = Math.min(1, Math.max(0, (1 - B[i]) / 0.5)); if (z < 0.02) continue;
      const n = vnoise(x, y, 2.4 * k, seed + 1) * 0.5 + vnoise(x, y, 8 * k, seed + 2) * 0.3 + hash(x, y, seed + 3) * 0.2, thr = rw * 1.15 * Math.pow(z, 1.35);
      const a = (1 - smooth(thr - 0.06, thr + 0.06, n)) * 0.94; if (a < 0.02) continue;
      const j = i * 4; bmp.rgba[j] = pc[0]; bmp.rgba[j + 1] = pc[1]; bmp.rgba[j + 2] = pc[2]; bmp.rgba[j + 3] = Math.round(a * 255); any = true;
    }
    if (any) layers.push({ kind: 'ink', name: 'frame-rub', noClip: true, regions: [], bitmap: bmp, blend: 'normal', spec: { mode: 'key', color: o.paper } });
  }
  return layers;
}
