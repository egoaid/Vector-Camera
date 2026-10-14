// render-ink.js - raster "ink" layers for the hybrid / screen-print mode (tone mapping, posterise, halftone, grain).
// Pure typed-array code (no DOM) so it is unit-testable. Output is cropped to the bbox of the eligible regions and
// is meant to be clipped by VECTOR paths of those regions.
import { makeScreen, htGain } from './halftone-types.js';
import { hexToRgb, mulberry32 } from './color-utils.js';
import { etchMask } from './etching.js';

function hash(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, cell, s) {
  const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Box (area-average) downscale of RGBA to the requested long edge. */
export function downscale(img, longEdge) {
  const k = Math.min(1, longEdge / Math.max(img.w, img.h)); if (k === 1) return img;
  const tw = Math.max(1, Math.round(img.w * k)), th = Math.max(1, Math.round(img.h * k)), out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) { const y0 = Math.floor((y * img.h) / th), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.h) / th));
    for (let x = 0; x < tw; x++) { const x0 = Math.floor((x * img.w) / tw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.w) / tw)); let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.w + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
      const o = (y * tw + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255; } }
  return { w: tw, h: th, data: out };
}
function rampColor(stops, t) {
  const n = stops.length - 1, f = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };

/**
 * Factory bound to a source image + pipeline result. spec -> { w,h,rgba,gx,gy,gw,gh } (geometry-space rect).
 * targetLong: raster resolution (long edge in px).
 */
export function makeInkFactory(src, res, targetLong) {
  const img = downscale(src, targetLong), tw = img.w, th = img.h, { w: gw0, h: gh0, labels } = res;
  const lum = new Float32Array(tw * th), blurMemo = new Map();
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (0.2126 * img.data[j] + 0.7152 * img.data[j + 1] + 0.0722 * img.data[j + 2]) / 255;
  const lab = new Int32Array(tw * th);
  for (let y = 0; y < th; y++) { const sy = Math.min(gh0 - 1, Math.floor((y * gh0) / th)) * gw0; for (let x = 0; x < tw; x++) lab[y * tw + x] = labels[sy + Math.min(gw0 - 1, Math.floor((x * gw0) / tw))]; }
  return (spec) => {
    const elig = new Uint8Array(res.R); for (const r of spec.regions) elig[r] = 1;
    let x0 = tw, y0 = th, x1 = -1, y1 = -1; const hist = new Uint32Array(256); let cnt = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = y * tw + x; if (!elig[lab[i]]) continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; hist[Math.min(255, (lum[i] * 255) | 0)]++; cnt++; }
    if (!cnt) return null;
    const pad = Math.ceil((tw / gw0) * 2.5); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(tw - 1, x1 + pad); y1 = Math.min(th - 1, y1 + pad);
    let acc = 0, lo = 0, hi = 255; for (let b = 0; b < 256; b++) { acc += hist[b]; if (acc >= cnt * 0.02) { lo = b; break; } }
    acc = 0; for (let b = 255; b >= 0; b--) { acc += hist[b]; if (acc >= cnt * 0.02) { hi = b; break; } }
    lo /= 255; hi = Math.max(hi / 255, lo + 0.05);
    const W = x1 - x0 + 1, H = y1 - y0 + 1, out = new Uint8ClampedArray(W * H * 4);
    // dilated eligibility so the vector clip (not pixel stair-steps) defines the visible edge
    const dil = new Uint8Array(W * H), rad = pad;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (elig[lab[(y + y0) * tw + x + x0]]) dil[y * W + x] = 1; }
    const tmp = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let k = -rad; k <= rad && !v; k++) { const xx = x + k; if (xx >= 0 && xx < W && dil[y * W + xx]) v = 1; } tmp[y * W + x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let k = -rad; k <= rad && !v; k++) { const yy = y + k; if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1; } dil[y * W + x] = v; }
    const n = Math.max(2, Math.min(8, spec.levels | 0)), ret = spec.retention, grain = spec.grain, rough = spec.roughness;
    const cell = Math.max(2, spec.halftoneSize * (tw / 640)), ang = (spec.halftoneAngle * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const htType = spec.halftoneType || 'dot', hopts = spec.halftoneOpts || {}, scr = makeScreen(htType, cell, ang, hopts), gain = htGain(hopts);
    const etch = spec.halftone && htType === 'etching';
    const blur = spec.halftone && htType !== 'dot' && !etch && (hopts.curve == null || hopts.curve > 0) ? (() => { const r = Math.max(2, Math.round(cell * 0.9)); if (!blurMemo.has(r)) blurMemo.set(r, boxBlur(lum, tw, th, r)); return blurMemo.get(r); })() : null; // tone image for form-following lines
    const screen = (x, y) => scr(x, y, blur ? blur[y * tw + x] - 0.5 : 0);
    const inkRGB = spec.mode === 'key' ? hexToRgb(spec.color) : null, stops = spec.mode === 'bands' ? spec.ramp.map(hexToRgb) : null, grainScale = Math.max(1, tw / 900);
    let em = null; // etching: strokes are drawn for the whole region first (they depend on their neighbours), then read per pixel
    if (etch) {
      const D = new Float32Array(W * H); // darkness of the whole bbox (outlines need the tone just outside the regions too)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) D[y * W + x] = Math.min(1, Math.max(0, (1 - (lum[(y + y0) * tw + x + x0] - lo) / (hi - lo)) * gain));
      let depthMap = null; // 0 far .. 1 near: the group (background / midground / subject) plus "lower in the picture = nearer"
      if (hopts.depth > 0) {
        depthMap = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const yy = (y + y0) / th, g = spec.groupOf ? spec.groupOf[lab[(y + y0) * tw + x + x0]] / 2 : yy; depthMap[y * W + x] = spec.groupOf ? 0.7 * g + 0.3 * yy : yy; }
        depthMap = boxBlur(depthMap, W, H, Math.max(2, Math.round(cell * 2.5)));
      }
      em = etchMask(D, W, H, dil, { cell, angle: ang, layers: hopts.layers, spread: hopts.spread, curve: hopts.curve, sketch: hopts.sketch, len: hopts.len, weight: hopts.weight, contour: hopts.contour, depth: hopts.depth, depthMap, seed: 7 });
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (!dil[p]) continue;
      const gx = x + x0, gy = y + y0, t = Math.max(0, Math.min(1, (lum[gy * tw + gx] - lo) / (hi - lo)));
      const wn = hash(gx, gy, 11) - 0.5, ln = vnoise(gx, gy, 3 * grainScale, 5) - 0.5, o = p * 4;
      if (spec.mode === 'key') {
        const d = 1 - t, dq = Math.round(d * (n - 1)) / (n - 1); let dd = dq + (d - dq) * ret * 0.7; if (spec.halftone) dd = Math.min(1, dd * gain);
        let s = 0.5 + wn * (grain * 0.3 + ret * 0.1) + ln * rough * 0.4;
        if (spec.halftone) s = htType === 'dot' ? s * 0.35 + screen(gx, gy) * 0.65 : s * 0.12 + screen(gx, gy) * 0.88;
        const a = em ? em[p] : smooth(s - 0.04, s + 0.04, dd);
        out[o] = inkRGB[0]; out[o + 1] = inkRGB[1]; out[o + 2] = inkRGB[2]; out[o + 3] = Math.round(a * 255);
      } else {
        let tt = t + wn * grain * 0.28 + ln * rough * 0.2; if (em) tt -= em[p] * 0.4; else if (spec.halftone) tt += (screen(gx, gy) - 0.5) * 0.45;
        tt = Math.max(0, Math.min(0.9999, tt));
        const q = (Math.floor(tt * n) + 0.5) / n, v = q + (t - q) * ret * 0.75, c = rampColor(stops, v);
        out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
      }
    }
    const k = gw0 / tw;
    return { w: W, h: H, rgba: out, gx: x0 * k, gy: y0 * k, gw: W * k, gh: H * k, opaque: spec.mode === 'bands' };
  };
}
/** Separable box blur of a Float32/Float64 tone image (running sums). */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
/** Deterministic paper-grain amount in [0,1] for a pixel (used by the canvas renderer). */
export const paperNoise = (x, y) => hash(x, y, 3) * 0.6 + vnoise(x, y, 4, 9) * 0.4;
export { mulberry32 };
