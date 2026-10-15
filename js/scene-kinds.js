// scene-kinds.js - the app's own "what is this region?" engine (no model, no network).
// It labels every pixel with a KIND (skin, hair, eye, brow, nose, mouth, ear, sky, foliage, grass, water, structure) from
//  - region statistics of the segmentation (colour, texture, orientation coherence, position, neighbours), and
//  - optional face landmarks (from face-landmarks.js) which add exact eyes / brows / nose / mouth / face shape / ears / hair zone.
// The kind map drives how every halftone / line style is drawn (different touches for skin, hair, leaves, sky ...).
// Pure typed-array code. Deterministic. Estimates: wrong calls are possible, so every consumer must treat KIND_NONE as "draw as usual".
export const K = { NONE: 0, SKIN: 1, HAIR: 2, EYE: 3, BROW: 4, NOSE: 5, MOUTH: 6, EAR: 7, SKY: 8, FOLIAGE: 9, GRASS: 10, WATER: 11, STRUCT: 12 };
export const KIND_NAMES = ['none', 'skin', 'hair', 'eye', 'brow', 'nose', 'mouth', 'ear', 'sky', 'foliage', 'grass', 'water', 'struct'];

// MediaPipe Face Mesh landmark groups (closed polygons unless noted)
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const EYE_R = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], EYE_L = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const BROW_R = [46, 53, 52, 65, 55, 107, 66, 105, 63, 70], BROW_L = [276, 283, 282, 295, 285, 336, 296, 334, 293, 300];
const NOSE = [193, 168, 417, 122, 351, 129, 358, 98, 327, 2, 4, 5, 195, 197, 6, 49, 279, 48, 278, 64, 294], NOSE_BOTTOM = [129, 49, 48, 64, 98, 97, 2, 326, 327, 294, 278, 279, 358];
const LID_UP_R = [33, 246, 161, 160, 159, 158, 157, 173, 133], LID_LO_R = [33, 7, 163, 144, 145, 153, 154, 155, 133], LID_UP_L = [362, 398, 384, 385, 386, 387, 388, 466, 263], LID_LO_L = [362, 382, 381, 380, 374, 373, 390, 249, 263];
const BROW_TOP_R = [70, 63, 105, 66, 107], BROW_TOP_L = [300, 293, 334, 296, 336], LIP_MID = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

/** Fills a polygon (flat [x0,y0,x1,y1...] in pixels) into map with value v. only(prev) filters which existing values may be overwritten. */
function fillPoly(map, w, h, pts, v, only) {
  let y0 = h, y1 = -1; for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1)); const n = pts.length / 2;
  for (let y = y0; y <= y1; y++) {
    const xs = []; const yc = y + 0.5;
    for (let i = 0, j = n - 1; i < n; j = i++) { const ay = pts[i * 2 + 1], by = pts[j * 2 + 1]; if ((ay > yc) !== (by > yc)) xs.push(pts[i * 2] + ((yc - ay) / (by - ay)) * (pts[j * 2] - pts[i * 2])); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[k + 1] - 0.5)); x++) { const i = y * w + x; if (!only || only(map[i])) map[i] = v; }
  }
}
const toPx = (face, idx, w, h) => { const o = new Float32Array(idx.length * 2); idx.forEach((k, i) => { o[i * 2] = face[k].x * w; o[i * 2 + 1] = face[k].y * h; }); return o; };

/** Per-pixel colour / texture features at working resolution. */
function features(rgba, w, h) {
  const n = w * h, Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n), H = new Float32Array(n), S = new Float32Array(n), V = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = rgba[j], g = rgba[j + 1], b = rgba[j + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b; Cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; V[i] = mx / 255; S[i] = mx ? d / mx : 0;
    let hh = 0; if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; } H[i] = hh;
  }
  // local texture (std of luma over a ~5px window) and orientation coherence (structure tensor, 9px window)
  const box = (a, r) => { const t = new Float32Array(n), o = new Float32Array(n), k = 2 * r + 1;
    for (let y = 0; y < h; y++) { let acc = 0; const row = y * w; for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[row + x] = acc / k; acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = acc / k; acc += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o; };
  const Yn = new Float32Array(n); for (let i = 0; i < n; i++) Yn[i] = Y[i] / 255;
  const m1 = box(Yn, 2), Y2 = new Float32Array(n); for (let i = 0; i < n; i++) Y2[i] = Yn[i] * Yn[i]; const m2 = box(Y2, 2), std = new Float32Array(n); for (let i = 0; i < n; i++) std[i] = Math.sqrt(Math.max(0, m2[i] - m1[i] * m1[i]));
  const gxx = new Float32Array(n), gxy = new Float32Array(n), gyy = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, dx = Yn[i + 1] - Yn[i - 1], dy = Yn[i + w] - Yn[i - w]; gxx[i] = dx * dx; gxy[i] = dx * dy; gyy[i] = dy * dy; }
  const bxx = box(gxx, 4), bxy = box(gxy, 4), byy = box(gyy, 4), coh = new Float32Array(n), ori = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = bxx[i] - byy[i], b2 = 2 * bxy[i], s = bxx[i] + byy[i]; coh[i] = s > 1e-4 ? Math.sqrt(a * a + b2 * b2) / s : 0; ori[i] = 0.5 * Math.atan2(b2, a); } // ori = gradient direction (the edge runs perpendicular)
  return { Y, Cb, Cr, H, S, V, std, coh, ori };
}
const isSkinPix = (f, i) => f.Cb[i] >= 77 && f.Cb[i] <= 127 && f.Cr[i] >= 133 && f.Cr[i] <= 173 && f.S[i] >= 0.1 && f.S[i] <= 0.8 && f.V[i] >= 0.16 && (f.H[i] <= 52 || f.H[i] >= 345);

/**
 * rgba: working image (w*h*4); labels: region id per pixel (Int32/Uint16, w*h), R: region count; groups: optional Uint8 per region (0 bg,1 mid,2 fg);
 * faces: optional list of 478-point landmark arrays ({x,y} in 0..1). Returns { map, strokes, faces:[{box}], counts }.
 */
export function analyzeKinds({ rgba, w, h, labels, R, groups = null, faces = [] }) {
  const n = w * h, f = features(rgba, w, h), map = new Uint8Array(n);
  // ---- region statistics ----
  const cnt = new Float64Array(R), sY = new Float64Array(R), sS = new Float64Array(R), sV = new Float64Array(R), sHx = new Float64Array(R), sHy = new Float64Array(R), sSd = new Float64Array(R), sCo = new Float64Array(R), sCy = new Float64Array(R), sCx = new Float64Array(R), sSk = new Float64Array(R), sOc = new Float64Array(R), sOs = new Float64Array(R), top = new Uint8Array(R), x0 = new Int32Array(R).fill(w), x1 = new Int32Array(R).fill(-1), y0 = new Int32Array(R).fill(h), y1 = new Int32Array(R).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, r = labels[i]; cnt[r]++; sY[r] += f.Y[i]; sS[r] += f.S[i]; sV[r] += f.V[i]; const hr = (f.H[i] * Math.PI) / 180; sHx[r] += Math.cos(hr) * f.S[i]; sHy[r] += Math.sin(hr) * f.S[i];
    sSd[r] += f.std[i]; sCo[r] += f.coh[i]; sCy[r] += y; sCx[r] += x; if (isSkinPix(f, i)) sSk[r]++; sOc[r] += Math.cos(2 * f.ori[i]) * f.coh[i]; sOs[r] += Math.sin(2 * f.ori[i]) * f.coh[i];
    if (y < h * 0.03) top[r] = 1; if (x < x0[r]) x0[r] = x; if (x > x1[r]) x1[r] = x; if (y < y0[r]) y0[r] = y; if (y > y1[r]) y1[r] = y;
  }
  const reg = [];
  for (let r = 0; r < R; r++) {
    const c = cnt[r] || 1, hue = ((Math.atan2(sHy[r], sHx[r]) * 180) / Math.PI + 360) % 360;
    reg.push({ n: cnt[r], Y: sY[r] / c, S: sS[r] / c, V: sV[r] / c, hue, hueStr: Math.hypot(sHx[r], sHy[r]) / c, std: sSd[r] / c, coh: sCo[r] / c, cy: sCy[r] / c / h, cx: sCx[r] / c / w, skin: sSk[r] / c, top: top[r], g: groups ? groups[r] : 1, horiz: Math.hypot(sOc[r], sOs[r]) / c, bbox: [x0[r], y0[r], x1[r], y1[r]] });
  }
  const kind = new Uint8Array(R), big = (r) => reg[r].n > n * 0.002;
  // ---- region rules ----
  for (let r = 0; r < R; r++) {
    const g = reg[r]; if (!big(r)) continue;
    const hue = g.hue, sat = g.S, val = g.V, tex = g.std;
    if (g.top && tex < 0.035 && ((hue >= 185 && hue <= 255 && sat > 0.1) || (val > 0.72 && sat < 0.18) || (g.cy < 0.35 && tex < 0.02))) { kind[r] = K.SKY; continue; }
    if (hue >= 62 && hue <= 170 && sat > 0.16 && val > 0.1 && g.hueStr > 0.06) { kind[r] = g.cy > 0.58 && tex < 0.055 ? K.GRASS : K.FOLIAGE; continue; }
    if (hue >= 175 && hue <= 250 && sat > 0.1 && g.cy > 0.62 && tex < 0.045 && !g.top) { kind[r] = K.WATER; continue; }
    if (g.skin > 0.55 && g.g >= 1) { kind[r] = K.SKIN; continue; }
    if (g.coh > 0.62 && tex > 0.012 && tex < 0.14 && sat < 0.4 && g.n > n * 0.01 && g.g <= 1) { kind[r] = K.STRUCT; continue; }
  }
  // ---- faces (landmarks) ----
  const faceInfo = [], strokes = [], pixelParts = [];
  for (const face of faces) {
    if (!face || face.length < 468) continue;
    const ov = toPx(face, FACE_OVAL, w, h); let fx0 = w, fx1 = 0, fy0 = h, fy1 = 0; for (let i = 0; i < ov.length; i += 2) { fx0 = Math.min(fx0, ov[i]); fx1 = Math.max(fx1, ov[i]); fy0 = Math.min(fy0, ov[i + 1]); fy1 = Math.max(fy1, ov[i + 1]); }
    const fw = fx1 - fx0, fh = fy1 - fy0; if (fw < w * 0.04 || fh < h * 0.04) continue;
    faceInfo.push({ box: [fx0 / w, fy0 / h, fx1 / w, fy1 / h] });
    // hair zone: an ellipse over the head, minus the face. Non-skin-coloured pixels there are hair.
    const hc = { x: (fx0 + fx1) / 2, y: fy0 + fh * 0.12 }, hz = new Float32Array(48 * 2); for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; hz[k * 2] = hc.x + Math.cos(a) * fw * 0.68; hz[k * 2 + 1] = hc.y + Math.sin(a) * fh * 0.62; }
    const zone = new Uint8Array(n); fillPoly(zone, w, h, hz, 1); fillPoly(zone, w, h, ov, 0);
    const earY0 = fy0 + fh * 0.38, earY1 = fy0 + fh * 0.78;
    pixelParts.push({ ov, zone, fx0, fx1, fy0, fy1, fw, fh, earY0, earY1, face });
  }
  // region votes for hair (regions mostly inside a hair zone become hair as a whole)
  if (pixelParts.length) {
    const inZone = new Float64Array(R), notSkin = new Float64Array(R);
    for (const pp of pixelParts) for (let i = 0; i < n; i++) if (pp.zone[i] && !isSkinPix(f, i)) inZone[labels[i]]++;
    for (let r = 0; r < R; r++) if (big(r) && inZone[r] > reg[r].n * 0.4 && kind[r] !== K.SKY && kind[r] !== K.FOLIAGE && !(reg[r].top && reg[r].std < 0.03 && reg[r].V > 0.6)) kind[r] = K.HAIR;
    for (let r = 0; r < R; r++) if (kind[r] === K.SKIN || kind[r] === K.HAIR) notSkin[r] = 1;
  } else {
    // no landmarks: a dark / textured region sitting on top of a skin region is probably hair
    const adj = new Map(); for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) { const a = labels[y * w + x], b = labels[(y + 1) * w + x]; if (a !== b) { adj.set(a * R + b, (adj.get(a * R + b) || 0) + 1); } }
    for (const [key, c] of adj) { const a = (key / R) | 0, b = key % R; if (kind[b] === K.SKIN && reg[a].n > n * 0.004 && kind[a] === K.NONE && reg[a].cy < reg[b].cy && reg[a].V < 0.45 && reg[a].S < 0.55 && c > 12 && reg[a].g >= 1) kind[a] = K.HAIR; }
  }
  // ---- paint regions, then the exact face parts on top ----
  for (let i = 0; i < n; i++) map[i] = kind[labels[i]];
  for (const pp of pixelParts) {
    const { face } = pp;
    fillPoly(map, w, h, pp.ov, K.SKIN, (v) => v !== K.EYE);
    for (let i = 0; i < n; i++) if (pp.zone[i] && !isSkinPix(f, i) && map[i] !== K.SKY && f.V[i] < 0.5 && f.S[i] < 0.6) map[i] = K.HAIR;
    // ears: skin-coloured pixels beside the face shape at eye-to-mouth height
    const ex = pp.fw * 0.3; for (let y = Math.max(0, Math.floor(pp.earY0)); y <= Math.min(h - 1, Math.ceil(pp.earY1)); y++) for (let x = Math.max(0, Math.floor(pp.fx0 - ex)); x <= Math.min(w - 1, Math.ceil(pp.fx1 + ex)); x++) { const i = y * w + x; if ((x < pp.fx0 + pp.fw * 0.06 || x > pp.fx1 - pp.fw * 0.06) && map[i] !== K.SKIN && map[i] !== K.EYE && isSkinPix(f, i)) map[i] = K.EAR; }
    for (const [idx, v] of [[NOSE, K.NOSE], [BROW_R, K.BROW], [BROW_L, K.BROW], [LIPS_OUTER, K.MOUTH], [EYE_R, K.EYE], [EYE_L, K.EYE]]) fillPoly(map, w, h, toPx(face, idx, w, h), v);
    if (face.length >= 478) for (const c of [468, 473]) { const cx = face[c].x * w, cy = face[c].y * h, r = Math.hypot(face[c + 1].x * w - cx, face[c + 1].y * h - cy) * 1.05, poly = new Float32Array(24); for (let k = 0; k < 12; k++) { poly[k * 2] = cx + Math.cos((k / 12) * 6.283) * r; poly[k * 2 + 1] = cy + Math.sin((k / 12) * 6.283) * r; } fillPoly(map, w, h, poly, K.EYE); }
    // outline strokes (x,y pairs) for the shapes a draughtsman draws as lines
    for (const idx of [LID_UP_R, LID_LO_R, LID_UP_L, LID_LO_L, BROW_TOP_R, BROW_TOP_L, NOSE_BOTTOM]) strokes.push(toPx(face, idx, w, h));
    const lipLine = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]; strokes.push(toPx(face, lipLine, w, h)); strokes.push(toPx(face, [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291], w, h));
  }
  const counts = new Uint32Array(13); for (let i = 0; i < n; i++) counts[map[i]]++;
  return { map, strokes, faces: faceInfo, counts, w, h };
}
