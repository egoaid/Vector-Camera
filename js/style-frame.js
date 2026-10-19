// style-frame.js - a paper margin ("white border") around the picture, with the imperfect edge of a hand-pulled print:
// the picture sits a little off-centre and slightly crooked, its edge is hand-cut (wobbly), the colour plates are misregistered so
// flat colour peeks out past the picture edge (like a multi-plate screen print), and the edge is worn (see frame-edge.js). The finished picture scene becomes one transformed + clipped group on a larger paper canvas,
// so every renderer (canvas, PNG, poster strips, SVG, PDF) draws it with the machinery that collage pieces already use.
import { mulberry32, hexToRgb } from './color-utils.js';
import { getPreset, allPresetColors } from './style-palette.js';
import { frameEdgeLayers } from './frame-edge.js';
import { polyGeom } from './style-collage.js';

export const FRAME_KEYS = ['frame', 'framePlate', 'framePlateN', 'frameRub', 'frameShift', 'frameColor', 'frameSeed'];
const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
export const frameOn = (p) => (p.frame | 0) > 0;

/** Geometry of the framed canvas for a picture of w x h (scene units): outer size, picture transform and the (wobbly) clip polygon in outer coordinates. */
export function frameGeometry(p, w, h) {
  const long = Math.max(w, h), s = (p.frameShift || 0) / 100, rub = (p.frameRub || 0) / 100;
  const ms = (p.frame / 100) * 0.18 * long, mb = ms;
  const rnd = mulberry32((((p.frameSeed | 0) + 17) * 2654435761) >>> 0);
  const dx = (rnd() * 2 - 1) * s * 0.35 * ms, dy = (rnd() * 2 - 1) * s * 0.3 * ms, th = ((rnd() * 2 - 1) * s * 1.3 * Math.PI) / 180;
  const W = w + 2 * ms, H = ms + h + mb, cx = W / 2 + dx, cy = ms + h / 2 + dy, co = Math.cos(th), si = Math.sin(th);
  const tf = [co, si, -si, co, cx - (co * (w / 2) - si * (h / 2)), cy - (si * (w / 2) + co * (h / 2))];
  const amp = (0.0006 + 0.0045 * Math.max(s, rub * 0.7)) * long, ctrl = () => Array.from({ length: 6 }, () => rnd() * amp);
  const inset = (c, u) => { const f = u * (c.length - 1), i = Math.min(c.length - 2, Math.floor(f)), t = f - i, e = t * t * (3 - 2 * t); return c[i] + (c[i + 1] - c[i]) * e; };
  const cT = ctrl(), cR = ctrl(), cB = ctrl(), cL = ctrl(), K = 28, g = [];
  for (let i = 0; i < K; i++) { const u = i / K; g.push(u * w, inset(cT, u)); }
  for (let i = 0; i < K; i++) { const u = i / K; g.push(w - inset(cR, u), u * h); }
  for (let i = 0; i < K; i++) { const u = i / K; g.push(w - u * w, h - inset(cB, u)); }
  for (let i = 0; i < K; i++) { const u = i / K; g.push(inset(cL, u), h - u * h); }
  const poly = new Float64Array(g.length); for (let i = 0; i < g.length; i += 2) { poly[i] = tf[0] * g[i] + tf[2] * g[i + 1] + tf[4]; poly[i + 1] = tf[1] * g[i] + tf[3] * g[i + 1] + tf[5]; }
  return { W, H, w, h, ms, mb, tf, poly };
}
/** Outer scene point -> picture coordinates (inverse of the picture transform). */
export function sceneToPicture(fr, X, Y) { const [a, b, c, d, e, f] = fr.tf, det = a * d - b * c, dx = X - e, dy = Y - f; return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det]; }
/** Picture point -> where it lands on the framed canvas. */
export const pictureToScene = (fr, x, y) => [fr.tf[0] * x + fr.tf[2] * y + fr.tf[4], fr.tf[1] * x + fr.tf[3] * y + fr.tf[5]];

/** Margin paper colour: the chosen colour, else the palette's paper. */
export const marginColor = (p) => (hexOk(p.frameColor) ? p.frameColor : getPreset(p).paper);

/** Flat colour for each misregistered plate: bright palette colours when the style has them, else a classic cyan / yellow / magenta set. */
function plateColors(preset, rnd, n) {
  const sat = (h) => { const [r, g, b] = hexToRgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; }, lum = (h) => { const [r, g, b] = hexToRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
  const pool = [...new Set(allPresetColors(preset))].filter((h) => sat(h) > 0.3 && lum(h) > 0.35), base = ['#2fb4c8', '#f2dd3a', '#e0507a'];
  const src = pool.length >= n ? pool : [...pool, ...base], out = [];
  for (let i = 0; i < n; i++) out.push(src.splice(Math.floor(rnd() * src.length), 1)[0]);
  return out;
}
/** Plate rectangles (outer coordinates): each is the picture rectangle moved a little (mostly sideways or up/down), slightly stretched and turned. */
export function platePolys(p, fr) {
  const n = Math.max(1, Math.min(3, p.framePlateN | 0 || 1)), amt = (p.framePlate || 0) / 100, long = Math.max(fr.w, fr.h), rnd = mulberry32((((p.frameSeed | 0) + 311) * 2246822519) >>> 0), polys = [];
  for (let i = 0; i < n; i++) {
    const side = Math.floor(rnd() * 4), sgn = side % 2 ? 1 : -1, big = (0.004 + 0.05 * amt) * long * (0.45 + 0.55 * rnd()), small = (rnd() * 2 - 1) * 0.35 * big;
    const dx = side < 2 ? sgn * big : small, dy = side < 2 ? small : sgn * big, st = 1 + (rnd() * 2 - 1) * 0.012 * amt, th = (rnd() * 2 - 1) * 0.5 * amt * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    const pts = []; for (const [x, y] of [[0, 0], [fr.w, 0], [fr.w, fr.h], [0, fr.h]]) { const ux = (x - fr.w / 2) * st, uy = (y - fr.h / 2) * st, gx = fr.w / 2 + ux * co - uy * si + dx, gy = fr.h / 2 + ux * si + uy * co + dy; pts.push(...pictureToScene(fr, gx, gy)); }
    polys.push(Float64Array.from([...pts, pts[0], pts[1]]));
  }
  return polys;
}
/** Wraps a finished picture scene (no text yet) into the framed scene. */
export function wrapFrame(inner, res, p) {
  const fr = frameGeometry(p, inner.w, inner.h), preset = getPreset(p), paper = marginColor(p);
  const group = { kind: 'group', name: 'picture', tf: fr.tf, clipPoly: fr.poly, w: inner.w, h: inner.h, paper: inner.paper, layers: inner.layers, geom: inner.geom || res.geom };
  const long = Math.max(inner.w, inner.h), scale = (p.fxLong || 1000) / long, layers = [];
  if ((p.framePlate || 0) > 0) { // colour plates under the picture: only the part that sticks out past the picture edge is visible
    const polys = platePolys(p, fr), cols = plateColors(preset, mulberry32((((p.frameSeed | 0) + 733) * 3266489917) >>> 0), polys.length);
    layers.push({ kind: 'fills', name: 'frame-plates', geom: polyGeom(polys, fr.W, fr.H), offset: [0, 0], rule: 'nonzero', blend: 'multiply', seal: 0, stroke: null, items: polys.map((_, i) => ({ fill: cols[i], regions: [i] })) });
  }
  layers.push(group, ...frameEdgeLayers({ poly: fr.poly, longUnits: long, scale, rub: p.frameRub || 0, seed: p.frameSeed, paper }));
  return { w: fr.W, h: fr.H, paper, paperAmount: inner.paperAmount, layers, mode: inner.mode, preset: inner.preset, geom: inner.geom || res.geom, frame: fr };
}
