// text-fx.js - print effects for the text overlay: halftone screen, dry-brush wear ("kasure") and ink dirt.
// The vector glyph outlines are rasterised to a coverage mask (scanline, nonzero, 4x vertical supersampling), the
// effects are applied to the mask, and the result is an RGBA "ink" bitmap. Because it goes through the normal ink
// layer path, it can be traced back into vector paths (SVG/PDF "convert raster to vector") like the photo ink.
// Pure typed-array code (no DOM) so it runs in Node tests.
import { hexToRgb } from './color-utils.js';
import { rotOff } from './config.js';
import { makeScreen, htOptsFrom } from './halftone-types.js';

function hash(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, cx, cy, s) {
  const fx = x / cx, fy = y / cy, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s), sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };

/** Flatten the glyph chains of `regions` to polylines in scene units. */
function flatten(geom, regions) {
  const polys = [];
  for (const r of regions) for (const loop of geom.loops[r]) {
    const pts = [];
    for (const code of loop) {
      const { cmds, pts: p } = geom.chains[code >> 1]; let cx = p[0], cy = p[1], o = 2; pts.push(cx, cy);
      for (let i = 0; i < cmds.length; i++) {
        if (cmds[i] === 3) { for (let k = 1; k <= 8; k++) { const t = k / 8, m = 1 - t; pts.push(m * m * m * cx + 3 * m * m * t * p[o] + 3 * m * t * t * p[o + 2] + t * t * t * p[o + 4], m * m * m * cy + 3 * m * m * t * p[o + 1] + 3 * m * t * t * p[o + 3] + t * t * t * p[o + 5]); } cx = p[o + 4]; cy = p[o + 5]; o += 6; }
        else { cx = p[o]; cy = p[o + 1]; pts.push(cx, cy); o += 2; }
      }
    }
    polys.push(pts);
  }
  return polys;
}
/** Coverage mask (Float32 0..1) of the geometry inside [x0,y0,x1,y1] (scene units) at `scale` px per unit. */
export function rasterizeGeom(geom, regions, bbox, scale) {
  const [bx0, by0, bx1, by1] = bbox, W = Math.max(1, Math.ceil((bx1 - bx0) * scale)), H = Math.max(1, Math.ceil((by1 - by0) * scale)), cov = new Float32Array(W * H), SS = 4;
  const edges = []; // x0,y0,x1,y1 in mask px, y0<y1, dir
  for (const pts of flatten(geom, regions)) {
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; let ax = (pts[i * 2] - bx0) * scale, ay = (pts[i * 2 + 1] - by0) * scale, bx = (pts[j * 2] - bx0) * scale, by = (pts[j * 2 + 1] - by0) * scale;
      if (ay === by) continue; let d = 1; if (ay > by) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; d = -1; }
      edges.push(ax, ay, bx, by, d);
    }
  }
  const E = edges.length / 5, xs = [];
  for (let y = 0; y < H; y++) for (let s = 0; s < SS; s++) {
    const sy = y + (s + 0.5) / SS; xs.length = 0;
    for (let e = 0; e < E; e++) { const o = e * 5; if (sy < edges[o + 1] || sy >= edges[o + 3]) continue; xs.push([edges[o] + ((sy - edges[o + 1]) / (edges[o + 3] - edges[o + 1])) * (edges[o + 2] - edges[o]), edges[o + 4]]); }
    if (xs.length < 2) continue; xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wind += xs[k][1]; if (!wind) continue; const xa = Math.max(0, xs[k][0]), xb = Math.min(W, xs[k + 1][0]); if (xb <= xa) continue;
      const ia = Math.floor(xa), ib = Math.floor(xb);
      if (ia === ib) cov[y * W + ia] += (xb - xa) / SS; else { cov[y * W + ia] += (ia + 1 - xa) / SS; for (let x = ia + 1; x < ib; x++) cov[y * W + x] += 1 / SS; if (ib < W) cov[y * W + ib] += (xb - ib) / SS; }
    }
  }
  for (let i = 0; i < cov.length; i++) if (cov[i] > 1) cov[i] = 1;
  return { W, H, cov };
}
export const fxActive = (p) => p.textHalftone > 0 || p.textWear > 0 || p.textDirt > 0;

/** Applies halftone / wear / dirt to a coverage mask in place (returns the alpha Float32). */
export function applyTextFx(m, p, scale, sceneLong) {
  const { W, H, cov } = m, seed = (p.textSeed | 0) + 7, out = new Float32Array(W * H);
  const cell = Math.max(2, p.textHalftoneSize * (sceneLong * scale) / 640), ang = (p.textHalftoneAngle * Math.PI) / 180, htType = p.textHalftoneType || 'dot';
  const screen = makeScreen(htType, cell, ang, htOptsFrom(p));
  const amt = p.textHalftone / 100, wear = p.textWear / 100, dirt = p.textDirt / 100, k = Math.max(1, (sceneLong * scale) / 1000);
  // text extent (for the tone gradient)
  let minx = W, maxx = 0, miny = H, maxy = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cov[y * W + x] > 0.5) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  const gx = Math.max(1, maxx - minx), gy = Math.max(1, maxy - miny);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let a = cov[i];
    if (a > 0 && amt > 0) {
      const mode = p.textHalftoneMode; let v = mode === 'down' ? (y - miny) / gy : mode === 'up' ? 1 - (y - miny) / gy : mode === 'right' ? (x - minx) / gx : 1;
      const tone = 1 - amt * 0.88 * Math.max(0, Math.min(1, v)); const s = screen(x, y);
      a *= smooth(s - 0.07, s + 0.07, tone * 1.02);
    }
    if (a > 0 && wear > 0) { // dry-brush streaks: noise stretched along x, two octaves + grit
      const n = vnoise(x, y, 46 * k, 5 * k, seed) * 0.55 + vnoise(x, y, 14 * k, 2.2 * k, seed + 3) * 0.3 + hash(x, y, seed + 9) * 0.15;
      a *= smooth(wear * 0.78 - 0.07, wear * 0.78 + 0.07, n);
    }
    out[i] = a;
  }
  if (dirt > 0) { // speckles and blots near the letters
    const R = Math.max(2, Math.round(9 * k)), near = new Uint8Array(W * H), tmp = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) tmp[i] = cov[i] > 0.4 ? 1 : 0;
    const dil = (src, dst, horizontal) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let t = -R; t <= R && !v; t++) { const xx = horizontal ? x + t : x, yy = horizontal ? y : y + t; if (xx >= 0 && xx < W && yy >= 0 && yy < H && src[yy * W + xx]) v = 1; } dst[y * W + x] = v; } };
    dil(tmp, near, true); dil(near, tmp, false);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!tmp[i]) continue;
      const big = vnoise(x, y, 9 * k, 9 * k, seed + 21), small = vnoise(x, y, 3.2 * k, 3.2 * k, seed + 33);
      const hit = big > 1 - dirt * 0.22 || small > 1 - dirt * 0.1; if (hit) out[i] = Math.max(out[i], smooth(0.4, 0.55, hit ? Math.max(big - (1 - dirt * 0.22) + 0.5, small - (1 - dirt * 0.1) + 0.5) : 0));
    }
  }
  return out;
}
/** Builds the ink bitmaps (shadow first, then text) for the text geometry. Returns [] if there is nothing to draw. */
export function textFxLayers(geom, p, sceneW, sceneH, fxLong) {
  const ids = Array.from({ length: geom.R }, (_, i) => i); if (!ids.length) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of geom.chains) { const q = c.pts; for (let i = 0; i < q.length; i += 2) { if (q[i] < x0) x0 = q[i]; if (q[i] > x1) x1 = q[i]; if (q[i + 1] < y0) y0 = q[i + 1]; if (q[i + 1] > y1) y1 = q[i + 1]; } }
  if (!isFinite(x0)) return [];
  const long = Math.max(sceneW, sceneH), scale = fxLong / long, off = (p.textShadow / 100) * 0.05 * sceneH, pad = 0.03 * long + off + 0.02 * long * (p.textDirt / 100);
  const bbox = [x0 - pad, y0 - pad, x1 + pad + off, y1 + pad + off], m = rasterizeGeom(geom, ids, bbox, scale), a = applyTextFx(m, p, scale, long), n = m.W * m.H;
  const mk = (hex) => { const [r, g, b] = hexToRgb(hex), rgba = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = Math.round(a[i] * 255); } return rgba; };
  const bm = (hex, dx, dy) => ({ w: m.W, h: m.H, rgba: mk(hex), gx: bbox[0] + dx, gy: bbox[1] + dy, gw: m.W / scale, gh: m.H / scale });
  const out = [];
  if (p.textShadow > 0) out.push({ kind: 'ink', name: 'text-shadow', noClip: true, regions: [], bitmap: bm(p.textShadowColor, ...rotOff(off, off, p.lightDir)), blend: 'normal', spec: { mode: 'key', color: p.textShadowColor } });
  out.push({ kind: 'ink', name: 'text', noClip: true, regions: [], bitmap: bm(p.textColor, 0, 0), blend: 'normal', spec: { mode: 'key', color: p.textColor } });
  return out;
}
