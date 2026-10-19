// style-frame.js - a paper margin ("white border") around the picture, with the imperfect edge of a hand-pulled print:
// the picture sits a little off-centre and slightly crooked, its edge is hand-cut (wobbly), ink bleeds a little into the margin and
// the edge is worn (see frame-edge.js). The finished picture scene becomes one transformed + clipped group on a larger paper canvas,
// so every renderer (canvas, PNG, poster strips, SVG, PDF) draws it with the machinery that collage pieces already use.
import { mulberry32, hexToRgb } from './color-utils.js';
import { getPreset } from './style-palette.js';
import { frameEdgeLayers } from './frame-edge.js';

export const FRAME_KEYS = ['frame', 'frameBottom', 'frameBleed', 'frameRub', 'frameShift', 'frameColor', 'frameSeed'];
const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
export const frameOn = (p) => (p.frame | 0) > 0;

/** Geometry of the framed canvas for a picture of w x h (scene units): outer size, picture transform and the (wobbly) clip polygon in outer coordinates. */
export function frameGeometry(p, w, h) {
  const long = Math.max(w, h), s = (p.frameShift || 0) / 100, rub = (p.frameRub || 0) / 100;
  const ms = (p.frame / 100) * 0.18 * long, mb = ms * (1 + ((p.frameBottom || 0) / 100) * 0.8);
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

// colour of the picture's edge along its perimeter (from the fills that cover the border pixels), so the bleed has the colours the print had there
function perimeterColors(inner, res, preset) {
  const byRegion = new Map(); for (const L of inner.layers) if (L.kind === 'fills' && (L.name === 'color-blocks' || L.name === 'color-regions' || L.name === 'silhouette' || L.name === 'regions')) for (const it of L.items) if (it.fill) for (const r of it.regions) byRegion.set(r, it.fill);
  const ink = hexToRgb(preset.ink || '#17121c'), N = 96, w = res.w, h = res.h, out = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 4, side = Math.floor(t), u = t - side; let x, y;
    if (side === 0) { x = Math.floor(u * (w - 1)); y = 0; } else if (side === 1) { x = w - 1; y = Math.floor(u * (h - 1)); } else if (side === 2) { x = w - 1 - Math.floor(u * (w - 1)); y = h - 1; } else { x = 0; y = h - 1 - Math.floor(u * (h - 1)); }
    const f = byRegion.get(res.labels[y * w + x]), c = f ? hexToRgb(f) : ink; out.push([c[0] * 0.7 + ink[0] * 0.3, c[1] * 0.7 + ink[1] * 0.3, c[2] * 0.7 + ink[2] * 0.3]);
  }
  return out;
}
/** Wraps a finished picture scene (no text yet) into the framed scene. */
export function wrapFrame(inner, res, p) {
  const fr = frameGeometry(p, inner.w, inner.h), preset = getPreset(p), paper = marginColor(p), cols = perimeterColors(inner, res, preset), N = cols.length;
  const edgeAt = (X, Y) => { // nearest side of the (straightened) picture decides which perimeter colour the bleed takes
    const [gx, gy] = sceneToPicture(fr, X, Y), u = Math.max(0, Math.min(1, gx / fr.w)), v = Math.max(0, Math.min(1, gy / fr.h)), dT = gy, dB = fr.h - gy, dL = gx, dR = fr.w - gx, m = Math.min(dT, dB, dL, dR);
    const t = m === dT ? u / 4 : m === dR ? 0.25 + v / 4 : m === dB ? 0.5 + (1 - u) / 4 : 0.75 + (1 - v) / 4; return cols[Math.min(N - 1, Math.floor(t * N))];
  };
  const group = { kind: 'group', name: 'picture', tf: fr.tf, clipPoly: fr.poly, w: inner.w, h: inner.h, paper: inner.paper, layers: inner.layers, geom: inner.geom || res.geom };
  const long = Math.max(inner.w, inner.h), scale = (p.fxLong || 1000) / long;
  const edge = frameEdgeLayers({ poly: fr.poly, longUnits: long, scale, bleed: p.frameBleed || 0, rub: p.frameRub || 0, seed: p.frameSeed, edgeAt, edgeKey: cols.map((c) => c.map(Math.round).join(',')).join(';'), paper, ink: preset.ink });
  return { w: fr.W, h: fr.H, paper, paperAmount: inner.paperAmount, layers: [group, ...edge], mode: inner.mode, preset: inner.preset, geom: inner.geom || res.geom, frame: fr };
}
