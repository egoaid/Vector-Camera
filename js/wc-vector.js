// wc-vector.js - the watercolour as real vector shapes (SVG / PDF export).
// Every brush stroke of the raster painting is traced to the outline of the paint it actually put down (ragged edge, cut-outs where paper was
// left bare, stopped by edges of the photo), and becomes one polygon filled with its colour (the transmittance of the paint) and blended by
// MULTIPLY: overlapping strokes therefore darken and mix colour exactly as in the raster. A thin outline of the same kind stands for the darker
// rim where pigment pooled. Paper grain, wet bleeding and blooms are raster-only textures and are not part of the vector version.
import { rgbToHex, hueMatrix } from './color-utils.js';

/** Closed outlines of {f >= level} in a W*H grid (outside = 0): marching squares with linear interpolation. Returns rings as flat [x,y,...] in grid units. */
export function maskRings(f, W, H, level = 0.5) {
  const val = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : f[y * W + x]), key = (h, x, y) => (((y + 1) * (W + 2) + (x + 1)) * 2 + h), pts = new Map(), segs = [];
  const hp = (x, y) => { const kk = key(0, x, y); if (!pts.has(kk)) { const a = val(x, y), b = val(x + 1, y); pts.set(kk, [x + (level - a) / (b - a), y]); } return kk; };
  const vp = (x, y) => { const kk = key(1, x, y); if (!pts.has(kk)) { const a = val(x, y), b = val(x, y + 1); pts.set(kk, [x, y + (level - a) / (b - a)]); } return kk; };
  for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
    const v0 = val(x, y), v1 = val(x + 1, y), v2 = val(x + 1, y + 1), v3 = val(x, y + 1), idx = (v0 >= level ? 1 : 0) | (v1 >= level ? 2 : 0) | (v2 >= level ? 4 : 0) | (v3 >= level ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = () => hp(x, y), B = () => hp(x, y + 1), L = () => vp(x, y), R = () => vp(x + 1, y), mid = (v0 + v1 + v2 + v3) / 4 >= level;
    switch (idx) {
      case 1: case 14: segs.push([L(), T()]); break; case 2: case 13: segs.push([T(), R()]); break; case 3: case 12: segs.push([L(), R()]); break;
      case 4: case 11: segs.push([R(), B()]); break; case 6: case 9: segs.push([T(), B()]); break; case 7: case 8: segs.push([L(), B()]); break;
      case 5: if (mid) segs.push([T(), R()], [L(), B()]); else segs.push([L(), T()], [R(), B()]); break;
      case 10: if (mid) segs.push([L(), T()], [R(), B()]); else segs.push([T(), R()], [L(), B()]); break;
    }
  }
  const adj = new Map(); segs.forEach((s, i) => { for (const e of s) { if (!adj.has(e)) adj.set(e, []); adj.get(e).push(i); } });
  const used = new Uint8Array(segs.length), rings = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue; used[s0] = 1; const ring = [pts.get(segs[s0][0])]; let cur = segs[s0][1], guard = 0;
    while (guard++ < 1e6) {
      ring.push(pts.get(cur)); const nx = (adj.get(cur) || []).find((i) => !used[i]); if (nx === undefined) break; used[nx] = 1; const s = segs[nx]; cur = s[0] === cur ? s[1] : s[0];
    }
    if (ring.length >= 4) { const out = new Float32Array(ring.length * 2); ring.forEach((p, i) => { out[i * 2] = p[0]; out[i * 2 + 1] = p[1]; }); rings.push(out); }
  }
  return rings;
}
/** Douglas-Peucker on a closed ring (flat xy); returns a flat array with at least 3 points or null. */
export function simplifyRing(r, eps) {
  const n = r.length / 2; if (n < 4) return null;
  const keep = new Uint8Array(n); let far = 0, fd = -1; for (let i = 1; i < n; i++) { const d = Math.hypot(r[i * 2] - r[0], r[i * 2 + 1] - r[1]); if (d > fd) { fd = d; far = i; } }
  keep[0] = 1; keep[far] = 1;
  const stack = [[0, far], [far, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); if (b <= a + 1) continue; const ax = r[a * 2], ay = r[a * 2 + 1], bx = r[b * 2], by = r[b * 2 + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9; let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((r[i * 2] - ax) * dy - (r[i * 2 + 1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(r[i * 2], r[i * 2 + 1]);
  return out.length >= 6 ? Float32Array.from(out) : null;
}
const ringArea = (r) => { let a = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } return Math.abs(a) / 2; };

/** Collects the strokes of paintStrokes (onStroke) as traced outlines. */
export function strokeCollector(k) {
  const recs = [];
  return {
    recs,
    onStroke(s) {
      const rings = []; for (const r of maskRings(s.fp, s.bw, s.bh, 0.5)) { const q = simplifyRing(r, 0.45 * Math.max(1, k)); if (q && ringArea(q) >= 5 * k * k) { for (let i = 0; i < q.length; i += 2) { q[i] += s.x0 + 0.5; q[i + 1] += s.y0 + 0.5; } rings.push(q); } }
      if (rings.length) recs.push({ rings, mean: [s.sum[0] / s.cnt, s.sum[1] / s.cnt, s.sum[2] / s.cnt], rimK: s.rimK, hw: s.hw });
    },
  };
}
/** records + overall density gain -> items [{rings, fill, rim, rimW}] (colours = transmittance of the paint, hue shift applied). */
export function vectorItems(recs, gain, hue, k) {
  const hm = hue ? hueMatrix(hue) : null, col = (d0, d1, d2) => { let r = 255 * Math.exp(-d0), g = 255 * Math.exp(-d1), b = 255 * Math.exp(-d2); if (hm) { const r2 = hm[0] * r + hm[1] * g + hm[2] * b, g2 = hm[3] * r + hm[4] * g + hm[5] * b; b = hm[6] * r + hm[7] * g + hm[8] * b; r = r2; g = g2; } return rgbToHex(r, g, b); };
  return recs.map((s) => {
    const d = s.mean.map((v) => v * gain * 0.86), // hard edges instead of the raster's soft ones cover more, so a little less paint
       it = { rings: s.rings, fill: col(d[0], d[1], d[2]) };
    if (s.rimK > 0.06) { it.rim = col(d[0] * s.rimK * 0.7, d[1] * s.rimK * 0.7, d[2] * s.rimK * 0.7); it.rimW = Math.max(0.9 * k, Math.min(2.6 * k, 0.07 * s.hw)); }
    return it;
  });
}
