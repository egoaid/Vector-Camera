// style-collage.js - arranges several independently styled images into one scene: torn paper, grid, strips, mosaic.
// Each piece is a scene 'group' (own geometry + affine transform + torn clip polygon), so SVG / PDF stay vector.
import { buildBase, addLines } from './style-scene.js';
import { needsInk } from './config.js';
import { mulberry32 } from './color-utils.js';
import { PRESETS, STYLE_ORDER } from './style-palette.js';
import { textLayers } from './style-text.js';

export const ASPECTS = { '4:5': [1000, 1250], '1:1': [1000, 1000], '3:4': [1000, 1333], '16:9': [1280, 720], '9:16': [720, 1280], '3:2': [1200, 800] };
export const LAYOUTS = ['torn', 'grid', 'strips', 'mosaic'];
export const EDGES = ['organic', 'rough', 'cut'];

/** 1-D smooth noise (value noise, cosine-eased) sampled at distance s with wavelength `wl`; knots from rnd. */
function makeNoise(rnd, n = 256) { const k = Array.from({ length: n + 2 }, () => rnd() * 2 - 1); return (s, wl) => { const f = (s / wl) % n, i = Math.floor(f), u = f - i, e = (1 - Math.cos(Math.PI * u)) / 2; return k[i] * (1 - e) + k[i + 1] * e; }; }
/**
 * Hand-torn paper: each side is torn as a person would - a long meandering line (low frequency), fibre jitter that comes
 * in "runs" (where the paper resisted), bites / notches, plus sometimes a torn-off corner. Returns { poly, rim }:
 * `rim` is the pale paper-fibre layer that peeks out under the print; its width varies smoothly along the edge.
 */
export function organicPolygon(cx, cy, w, h, rot, amp, rnd, tornSides = [1, 1, 1, 1]) {
  const hw = w / 2, hh = h / 2, C = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], P = [], R = [];
  const nLow = makeNoise(rnd), nMid = makeNoise(rnd), nFib = makeNoise(rnd), nRun = makeNoise(rnd), nRim = makeNoise(rnd), cuts = [0, 1, 2, 3].map(() => (rnd() < 0.4 ? 0.04 + rnd() * 0.1 : 0));
  const bites = []; for (let i = 0; i < 4; i++) { const n = Math.floor(rnd() * 3); for (let k = 0; k < n; k++) bites.push({ side: i, t: 0.1 + rnd() * 0.8, wd: 0.03 + rnd() * 0.07, dp: (rnd() < 0.7 ? 1 : -1) * (0.8 + rnd() * 1.4) }); }
  let sOff = 0;
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = uy, ny = -ux; // outward normal for clockwise rect
    const torn = tornSides[i] ? 1 : 0.18, step = Math.max(3, len / 140), n = Math.ceil(len / step), corner = cuts[i] * Math.min(w, h);
    for (let j = 0; j < n; j++) {
      const t = j / n, s = sOff + t * len, edgeFade = Math.min(1, Math.min(t, 1 - t) * 12 + 0.25);
      const run = 0.25 + 0.75 * Math.max(0, nRun(s, 90) * 0.5 + 0.5) ** 1.6;                  // fibre runs
      let d = (nLow(s, 170) * 1.0 + nMid(s, 55) * 0.45) * amp + nFib(s, 5.5) * amp * 0.28 * run + (nFib(s * 3.1, 2.1)) * amp * 0.08 * run;
      d *= torn * edgeFade; for (const bt of bites) if (bt.side === i) { const q = (t - bt.t) / bt.wd; d -= bt.dp * amp * 1.3 * Math.exp(-q * q) * torn; }
      let x = a[0] + ux * len * t, y = a[1] + uy * len * t;
      if (corner > 0) { const ct = corner / len; if (t < ct) d -= (1 - t / ct) * corner * 0.9; else if (t > 1 - ct) d -= ((t - (1 - ct)) / ct) * corner * 0.9; }
      const rimW = amp * (0.28 + 0.2 * (nRim(s, 120) * 0.5 + 0.5) + 0.25 * Math.max(0, nRim(s * 1.7, 14))) * (tornSides[i] ? 1 : 0.15);
      P.push(x + nx * d, y + ny * d); R.push(x + nx * (d + rimW), y + ny * (d + rimW));
    }
    sOff += len;
  }
  const ca = Math.cos(rot), sa = Math.sin(rot), tf = (arr) => { const o = new Float64Array(arr.length); for (let i = 0; i < arr.length; i += 2) { o[i] = cx + arr[i] * ca - arr[i + 1] * sa; o[i + 1] = cy + arr[i] * sa + arr[i + 1] * ca; } return o; };
  return { poly: tf(P), rim: tf(R) };
}

/** Value-noise torn edge from (x0,y0) to (x1,y1): returns flat xy (excluding the end point). */
function tornEdge(x0, y0, x1, y1, amp, rnd, step = 7) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / step)), nx = -(y1 - y0) / len, ny = (x1 - x0) / len, out = [];
  let d = 0, v = 0; const knots = []; for (let i = 0; i <= Math.ceil(n / 4) + 1; i++) knots.push((rnd() - 0.5) * 2);
  for (let i = 0; i < n; i++) {
    const t = i / n, f = (i / 4), k = Math.floor(f), u = f - k, s = u * u * (3 - 2 * u);
    v = knots[k] * (1 - s) + knots[k + 1] * s; d = (v * 0.8 + (rnd() - 0.5) * 0.22) * amp;
    out.push(x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d);
  }
  return out;
}
/** Polygon (flat xy) for a w x h rect centred at (cx,cy), rotated by `rot` rad; torn sides get a ragged edge. */
export function slotPolygon(cx, cy, w, h, rot, tornAmp, rnd, tornSides = [1, 1, 1, 1]) {
  const hw = w / 2, hh = h / 2, C = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], pts = [];
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4];
    if (tornSides[i] && tornAmp > 0) pts.push(...tornEdge(a[0], a[1], b[0], b[1], tornAmp, rnd)); else pts.push(a[0], a[1]);
  }
  const ca = Math.cos(rot), sa = Math.sin(rot), out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) { out[i] = cx + pts[i] * ca - pts[i + 1] * sa; out[i + 1] = cy + pts[i] * sa + pts[i + 1] * ca; }
  return out;
}
/** Mini geometry for polygons (used for torn-paper rims). */
export function polyGeom(polys, w, h) {
  const chains = polys.map((xy) => { const n = xy.length / 2, cmds = new Uint8Array(n - 1).fill(2), pts = new Float64Array(xy); return { cmds, pts }; });
  return { w, h, R: polys.length, chains, loops: chains.map((_, i) => [Int32Array.of(i * 2 + 1)]) };
}
/** Slot rectangles [{cx,cy,w,h,rot,torn}] for a layout. */
export function layoutSlots(layout, n, W, H, p, rnd) {
  const gap = (p.collageGap / 100) * 0.05 * Math.min(W, H), rotMax = (p.collageRotate / 100) * 0.12, slots = [];
  if (layout === 'grid') {
    const cols = Math.max(1, Math.round(Math.sqrt((n * W) / H))), rows = Math.ceil(n / cols), cw = (W - gap) / cols, ch = (H - gap) / rows;
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); slots.push({ cx: gap / 2 + cw * (c + 0.5), cy: gap / 2 + ch * (r + 0.5), w: cw - gap, h: ch - gap, rot: 0, torn: 0 }); }
  } else if (layout === 'strips') {
    const vertical = W >= H * 0.8, k = n, ov = 0.06;
    for (let i = 0; i < n; i++) {
      if (vertical) { const sw = W / k, jitter = (rnd() - 0.5) * H * 0.05; slots.push({ cx: sw * (i + 0.5), cy: H / 2 + jitter, w: sw * (1 + ov) - gap, h: H * (0.88 + rnd() * 0.12), rot: (rnd() - 0.5) * rotMax * 0.5, torn: 1 }); }
      else { const sh = H / k; slots.push({ cx: W / 2 + (rnd() - 0.5) * W * 0.05, cy: sh * (i + 0.5), w: W * (0.88 + rnd() * 0.12), h: sh * (1 + ov) - gap, rot: (rnd() - 0.5) * rotMax * 0.5, torn: 1 }); }
    }
  } else if (layout === 'mosaic') {
    let rects = [[0, 0, W, H]];
    while (rects.length < n) { rects.sort((a, b) => b[2] * b[3] - a[2] * a[3]); const [x, y, w, h] = rects.shift(), f = 0.35 + rnd() * 0.3; if (w > h) rects.push([x, y, w * f, h], [x + w * f, y, w * (1 - f), h]); else rects.push([x, y, w, h * f], [x, y + h * f, w, h * (1 - f)]); }
    rects.forEach(([x, y, w, h]) => slots.push({ cx: x + w / 2, cy: y + h / 2, w: w - gap, h: h - gap, rot: 0, torn: 0.5 }));
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  } else { // torn: overlapping sheets cascading across the canvas
    const big = Math.min(W, H) * (n <= 3 ? 0.78 : 0.62);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), a = W >= H;
      const cx = a ? W * (0.22 + 0.56 * t) + (rnd() - 0.5) * W * 0.08 : W * (0.35 + 0.3 * rnd()), cy = a ? H * (0.3 + 0.4 * rnd()) : H * (0.2 + 0.6 * t) + (rnd() - 0.5) * H * 0.06;
      const sw = big * (0.9 + rnd() * 0.35), sh = big * (0.9 + rnd() * 0.35) * (a ? 1 : 0.9);
      slots.push({ cx, cy, w: a ? sw : sw * 1.15, h: sh, rot: (rnd() - 0.5) * rotMax * 2, torn: 1 });
    }
  }
  return slots;
}
/**
 * cells: [{ res, groups, ink: (longPx)=>factory|null }]. p: UI params. opts: { inkLong }.
 * Returns a scene {w,h,paper,layers:[group...], mode:'collage'} (text overlay included).
 */
export function buildCollageScene(cells, p, { inkLong = 700 } = {}) {
  const [W, H] = ASPECTS[p.collageAspect] || ASPECTS['4:5'], rnd = mulberry32((p.collageSeed | 0) + 17);
  const n = Math.max(cells.length, Math.min(16, p.collageSlots | 0)), slots = layoutSlots(p.collageLayout, n, W, H, p, rnd);
  const base = PRESETS[p.preset] || PRESETS.pop, paper = p.collagePaper || base.paper;
  const scene = { w: W, h: H, paper, paperAmount: p.mode === 'hybrid' ? p.paper / 100 : 0, layers: [], mode: 'collage', preset: p.preset, geom: null };
  const rimGeoms = [], polys = [];
  const vary = p.collageVary ? ['pop', ...STYLE_ORDER.filter((s) => s !== p.preset)].sort(() => rnd() - 0.5).slice(0, 4) : null;
  const tornAmp = (p.collageTorn / 100) * 0.05 * Math.min(W, H);
  slots.forEach((sl, i) => {
    const cell = cells[i % cells.length], res = cell.res, pp = vary && i > 0 ? { ...p, preset: vary[i % vary.length], bgTreatment: (PRESETS[vary[i % vary.length]] || {}).bgTreatment || p.bgTreatment } : p;
    const sub = buildBase(res, cell.groups, pp, needsInk(pp) ? cell.ink(inkLong) : null); addLines(sub, res, cell.groups, pp);
    const sc = Math.max(sl.w / res.w, sl.h / res.h) * (1 + (i % 3 === 1 ? 0.12 : 0)), a = sc * Math.cos(sl.rot), b = sc * Math.sin(sl.rot), c = -b, d = a;
    const e = sl.cx - (a * res.w / 2 + c * res.h / 2), f = sl.cy - (b * res.w / 2 + d * res.h / 2);
    const tornSides = [1, 1, 1, 1].map(() => (rnd() < 0.75 ? 1 : 0)), edge = p.collageEdge || 'organic', amp = tornAmp * (edge === 'cut' ? 0 : sl.torn || 0);
    let poly, rim;
    if (edge === 'organic' && amp > 0) { ({ poly, rim } = organicPolygon(sl.cx, sl.cy, sl.w, sl.h, sl.rot, amp * 1.6, rnd, tornSides)); }
    else {
      poly = slotPolygon(sl.cx, sl.cy, sl.w, sl.h, sl.rot, amp, rnd, tornSides);
      rim = poly.slice(); { const gx = 1 + (tornAmp * 0.35) / (sl.w / 2), gy = 1 + (tornAmp * 0.35) / (sl.h / 2), ca = Math.cos(-sl.rot), sa = Math.sin(-sl.rot), cr = Math.cos(sl.rot), sr = Math.sin(sl.rot); for (let q = 0; q < rim.length; q += 2) { const dx = rim[q] - sl.cx, dy = rim[q + 1] - sl.cy, u = (dx * ca - dy * sa) * gx, v = (dx * sa + dy * ca) * gy; rim[q] = sl.cx + u * cr - v * sr; rim[q + 1] = sl.cy + u * sr + v * cr; } }
    }
    if (amp > 0) { polys.push(rim); rimGeoms.push(i); }
    scene.layers.push({ kind: 'group', name: 'piece-' + (i + 1), tf: [a, b, c, d, e, f], clipPoly: poly, paper: sub.paper, w: res.w, h: res.h, geom: res.geom, layers: sub.layers, _rim: amp > 0 ? polys.length - 1 : -1 });
  });
  // torn-paper rims go underneath each piece (the "fibre" edge); inserted before the group they belong to
  if (polys.length) {
    const out = [], pg = polyGeom(polys, W, H);
    for (const L of scene.layers) { if (L._rim >= 0 && polys[L._rim] && rimGeoms.length) out.push({ kind: 'fills', name: 'rim-' + L.name, geom: pg, offset: [0, 0], rule: 'nonzero', seal: 0, stroke: null, items: [{ fill: '#fbf7ee', regions: [L._rim] }] }); delete L._rim; out.push(L); }
    scene.layers = out;
  } else for (const L of scene.layers) delete L._rim;
  for (const L of textLayers(p, W, H)) scene.layers.push(L);
  return scene;
}
