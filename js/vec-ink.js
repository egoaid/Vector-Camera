// vec-ink.js - raster ink layer -> true vector shapes (the silkscreen "raster" part becomes paths too).
// The ink bitmap is reduced to a small label map (ink / paper for key plates, N tone levels for tone plates),
// despeckled, then traced with the same shared-boundary tracer + Bezier fitter used for the photo regions.
import { buildGeometry } from './vec-geometry.js';
import { hexToRgb, rgbToHex } from './color-utils.js';

export const TRACE_SHAPE = { smooth: 1, eps: 0.45, fitErr: 0.55, cornerDeg: 62, angular: false };

function rampAt(stops, t) {
  const n = stops.length - 1, f = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}
/** Remove 4-connected components smaller than `min` px by relabelling them to the surrounding value (binary-ish cleanup per label). */
export function despeckle(lab, w, h, min) {
  if (min <= 1) return lab;
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (seen[s]) continue; const v = lab[s]; let sp = 0, n = 0; stack[sp++] = s; seen[s] = 1; const comp = []; let nb = -1;
    while (sp) {
      const i = stack[--sp]; n++; if (n <= min) comp.push(i); const x = i % w, y = (i / w) | 0;
      const tryN = (j) => { if (lab[j] === v) { if (!seen[j]) { seen[j] = 1; stack[sp++] = j; } } else if (nb < 0) nb = lab[j]; };
      if (x > 0) tryN(i - 1); if (x < w - 1) tryN(i + 1); if (y > 0) tryN(i - w); if (y < h - 1) tryN(i + w);
    }
    if (n < min && nb >= 0) for (const i of comp) lab[i] = nb;
  }
  return lab;
}
/** bitmap {w,h,rgba}, spec {mode:'key'|'bands', color, ramp[], levels} -> { labels:Int32Array, R, colors:[hex per label|null] } */
export function inkToLabels(b, spec, speck = 2) {
  const n = b.w * b.h, lab = new Int32Array(n);
  if (spec.mode === 'key') {
    for (let i = 0; i < n; i++) lab[i] = b.rgba[i * 4 + 3] >= 128 ? 1 : 0;
    despeckle(lab, b.w, b.h, speck);
    return { labels: lab, R: 2, colors: [null, spec.color] };
  }
  const L = Math.max(2, Math.min(8, spec.levels | 0)), stops = spec.ramp.map(hexToRgb), pal = Array.from({ length: L }, (_, j) => rampAt(stops, (j + 0.5) / L));
  for (let i = 0; i < n; i++) {
    if (b.rgba[i * 4 + 3] < 128) { lab[i] = L; continue; }
    const r = b.rgba[i * 4], g = b.rgba[i * 4 + 1], bl = b.rgba[i * 4 + 2]; let best = 0, bd = Infinity;
    for (let j = 0; j < L; j++) { const d = (r - pal[j][0]) ** 2 + (g - pal[j][1]) ** 2 + (bl - pal[j][2]) ** 2; if (d < bd) { bd = d; best = j; } }
    lab[i] = best;
  }
  despeckle(lab, b.w, b.h, speck);
  return { labels: lab, R: L + 1, colors: [...pal.map((c) => rgbToHex(c[0], c[1], c[2])), null] };
}
/**
 * Free-colour ink bitmaps (spatter, stains: spec.mode 'raw') -> a few flat colours. The most common colours (4 bits per channel) become the palette,
 * pixels go to the nearest one, transparent pixels to "nothing". Soft (translucent) paint is flattened: each colour is mixed toward white by its mean
 * opacity and the layer is multiplied, so a pale stain stays pale.
 */
export function rawToLabels(b, nCol = 6, speck = 2, exact = false) {
  const n = b.w * b.h, lab = new Int32Array(n), hist = new Map(), d = b.rgba;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] >= 40) { const k = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); }
  const pal = [...hist].sort((a, c) => c[1] - a[1]).slice(0, nCol).map(([k]) => [((k >> 8) << 4) | 8, (((k >> 4) & 15) << 4) | 8, ((k & 15) << 4) | 8]), L = Math.max(1, pal.length), as = new Float64Array(L), ac = new Float64Array(L);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3]; if (a < 40 || !pal.length) { lab[i] = L; continue; }
    let best = 0, bd = Infinity; for (let j = 0; j < pal.length; j++) { const e = (d[i * 4] - pal[j][0]) ** 2 + (d[i * 4 + 1] - pal[j][1]) ** 2 + (d[i * 4 + 2] - pal[j][2]) ** 2; if (e < bd) { bd = e; best = j; } }
    lab[i] = best; as[best] += a; ac[best]++;
  }
  despeckle(lab, b.w, b.h, speck);
  let colors;
  if (exact) { // opaque flat colours (the worn edge of a print): the real mean colour of each group, not mixed toward white
    const sr = new Float64Array(L), sg = new Float64Array(L), sb = new Float64Array(L), sn = new Float64Array(L);
    for (let i = 0; i < n; i++) { const j = lab[i]; if (j < pal.length) { sr[j] += d[i * 4]; sg[j] += d[i * 4 + 1]; sb[j] += d[i * 4 + 2]; sn[j]++; } }
    colors = pal.map((c, j) => (sn[j] ? rgbToHex(sr[j] / sn[j], sg[j] / sn[j], sb[j] / sn[j]) : rgbToHex(c[0], c[1], c[2])));
  } else colors = pal.map((c, j) => { const m = ac[j] ? as[j] / ac[j] / 255 : 1; return rgbToHex(255 + (c[0] - 255) * m, 255 + (c[1] - 255) * m, 255 + (c[2] - 255) * m); });
  return { labels: lab, R: L + 1, colors: [...colors, ...(pal.length ? [] : [null]), null].slice(0, L + 1) };
}
/** Scale chain coordinates in place: x*k+ox, y*k+oy. */
export function scaleGeom(geom, k, ox, oy) {
  for (const c of geom.chains) { const p = c.pts; for (let i = 0; i < p.length; i += 2) { p[i] = p[i] * k + ox; p[i + 1] = p[i + 1] * k + oy; } }
  geom._rev = null; return geom;
}
/** Pure tracing job (runs in the worker or on the main thread): label map -> geometry (bitmap pixel units). */
export function traceLabels(labels, w, h, R, shape = TRACE_SHAPE) { return buildGeometry(labels, w, h, R, shape); }

/** Build the vector replacement layer for an ink layer from its traced geometry. */
export function vectorLayer(L, geom, info) {
  const b = L.bitmap, k = b.gw / b.w; scaleGeom(geom, k, b.gx, b.gy);
  const items = []; info.colors.forEach((c, r) => { if (c) items.push({ fill: c, regions: [r] }); });
  return { kind: 'fills', name: L.name + '-vector', geom, offset: [0, 0], seal: L.spec && L.spec.mode === 'bands' ? 0.5 : 0, stroke: null, blend: L.blend === 'multiply' ? 'multiply' : undefined, clip: L.noClip ? undefined : { regions: L.regions }, items };
}
/**
 * Replace every ink layer of a scene (recursing into groups) with traced vector layers.
 * tracer(labels,w,h,R) -> Promise<geom>; onProgress(done,total).
 */
export async function vectorizeScene(scene, tracer, { speck = 2, onProgress = () => {}, raw = false } = {}) {
  const jobs = []; const walk = (layers) => { for (const L of layers) { if (L.kind === 'ink' && (raw || !(L.spec && L.spec.mode === 'raw'))) jobs.push(L); if (L.layers) walk(L.layers); } }; walk(scene.layers);
  let done = 0; onProgress(0, jobs.length);
  const repl = new Map();
  for (const L of jobs) {
    const b = L.bitmap, isRaw = L.spec && L.spec.mode === 'raw', worn = L.name === 'frame-rub'; // the worn print edge shows what lies under it (paper x the colour plates): several opaque colours, drawn normally
    const info = worn ? rawToLabels(b, 8, speck, true) : isRaw ? rawToLabels(b, 6, speck) : inkToLabels(b, L.spec, speck), geom = await tracer(info.labels, b.w, b.h, info.R), vl = vectorLayer(L, geom, info); if (isRaw && !worn) vl.blend = 'multiply';
    repl.set(L, vl); onProgress(++done, jobs.length);
  }
  const apply = (layers) => layers.map((L) => (repl.has(L) ? repl.get(L) : L.layers ? { ...L, layers: apply(L.layers) } : L));
  scene.layers = apply(scene.layers); return jobs.length;
}
