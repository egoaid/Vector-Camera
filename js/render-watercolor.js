// render-watercolor.js - the "watercolour" mode: the photo painted as transparent washes on real paper.
// Steps (all typed-array code, no DOM):
//  1 washes     flat colour of every region mixed with a little of the blurred photo (so a wash still has a gradient)
//  2 lightness  watercolour is transparent: colours are lifted toward the paper
//  3 wet bleed  colours run into their neighbours where the paper was wet (varies across the picture)
//  4 highlights the brightest parts are left as bare paper, with ragged edges
//  5 edges      pigment pools into a darker rim at the edge of dry washes, only in places
//  6 granulation pigment settles into the valleys of the paper: the paper type decides the texture
//  7 mottling   uneven wash density and a few "blooms" (backruns: pale centre, dark ragged ring)
// The result is multiplied by the paper colour. Returns RGBA bytes (opaque).
import { boxBlur, hash, vnoise } from './tone-photo.js';
import { hexToRgb, mulberry32, hueMatrix } from './color-utils.js';

export const PAPERS = {
  hot: { color: '#fbf8f1', grain: 0.35, amount: 0.12 },   // smooth hot-pressed: fine tooth, little granulation
  cold: { color: '#f7f2e8', grain: 0.7, amount: 0.3 },    // cold-pressed: the classic medium tooth
  rough: { color: '#f4eee2', grain: 0.9, amount: 0.5 },  // rough: deep tooth, strong granulation
  washi: { color: '#f4ecdb', grain: 0.6, amount: 0.3, fibre: true }, // Japanese paper: long fibres
  tinted: { color: '#eadfc8', grain: 0.7, amount: 0.3 },  // cream / buff paper
};
export const PAPER_IDS = Object.keys(PAPERS);
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };

/** Height of the paper surface in [0,1] (valleys low): used for granulation. */
function paperHeight(id, x, y, k, seed) {
  if (id === 'hot') return hash(x, y, seed) * 0.55 + vnoise(x, y, 1.8 * k, seed + 1) * 0.45;
  if (id === 'rough') { const v = vnoise(x, y, 5 * k, seed) * 0.45 + vnoise(x, y, 11 * k, seed + 1) * 0.3 + hash(x, y, seed + 2) * 0.25; return Math.max(0, Math.min(1, (v - 0.5) * 1.5 + 0.5)); }
  if (id === 'washi') { // long fibres lying in two unrelated directions (not a woven grid)
    const c1 = 0.906, s1 = 0.423, c2 = 0.34, s2 = -0.94, u1 = x * c1 + y * s1, v1 = -x * s1 + y * c1, u2 = x * c2 + y * s2, v2 = -x * s2 + y * c2;
    return Math.max(0, Math.min(1, vnoise(u1 * 0.16, v1, 2.6 * k, seed) * 0.3 + vnoise(u2 * 0.12, v2, 2.2 * k, seed + 4) * 0.3 + vnoise(x, y, 9 * k, seed + 1) * 0.2 + hash(x, y, seed + 2) * 0.2));
  }
  return vnoise(x, y, 2.6 * k, seed) * 0.5 + vnoise(x, y, 6 * k, seed + 1) * 0.3 + hash(x, y, seed + 2) * 0.2; // cold / tinted
}

/** img {w,h,data RGBA}, lab Int32Array(w*h) region ids, stats {rgb} (0..255 per region), spec {bleed,edge,gran,light,hl,bloom 0..100, paper id, seed}. */
export function watercolorBitmap(img, lab, stats, spec) {
  const tw = img.w, th = img.h, N = tw * th, data = img.data, k = Math.max(1, Math.max(tw, th) / 1000), seed = (spec.seed | 0) + 13;
  const bleed = (spec.bleed ?? 45) / 100, edge = (spec.edge ?? 50) / 100, gran = (spec.gran ?? 50) / 100, light = (spec.light ?? 30) / 100, hl = (spec.hl ?? 40) / 100, bloom = (spec.bloom ?? 35) / 100;
  const pid = PAPERS[spec.paper] ? spec.paper : 'cold', paper = PAPERS[pid], pc = hexToRgb(paper.color), rgb = stats.rgb;
  const blur = (A, r) => boxBlur(A, tw, th, Math.max(1, r)), ch = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], pr = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let i = 0, j = 0; i < N; i++, j += 4) { pr[0][i] = data[j]; pr[1][i] = data[j + 1]; pr[2][i] = data[j + 2]; }
  const pb = pr.map((A) => blur(A, Math.max(2, Math.round(0.008 * tw))));
  // 1 + 2 washes, lifted toward the paper, a touch more saturated
  for (let i = 0; i < N; i++) {
    const l = lab[i]; let r = rgb[l * 3] * 0.55 + pb[0][i] * 0.45, g = rgb[l * 3 + 1] * 0.55 + pb[1][i] * 0.45, b = rgb[l * 3 + 2] * 0.55 + pb[2][i] * 0.45;
    const gy = 0.299 * r + 0.587 * g + 0.114 * b; r = gy + (r - gy) * 1.12; g = gy + (g - gy) * 1.12; b = gy + (b - gy) * 1.12;
    const q = 1 - 0.5 * light; ch[0][i] = 255 - (255 - r) * q; ch[1][i] = 255 - (255 - g) * q; ch[2][i] = 255 - (255 - b) * q;
  }
  // 3 wet bleed: colours run into each other where the paper was wet
  if (bleed > 0) {
    const rb = Math.max(2, Math.round((0.004 + 0.035 * bleed) * tw)), bl = ch.map((A) => blur(blur(A, rb), rb));
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = y * tw + x, w = Math.min(1, (0.1 + 0.9 * smooth(0.25, 0.75, vnoise(x, y, 0.16 * tw, seed))) * bleed * 1.25); for (let c = 0; c < 3; c++) ch[c][i] += (bl[c][i] - ch[c][i]) * w; }
  }
  // 4 highlights stay bare paper
  if (hl > 0) {
    const thr = 1 - 0.42 * hl;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = y * tw + x, L = (0.299 * pb[0][i] + 0.587 * pb[1][i] + 0.114 * pb[2][i]) / 255, m = smooth(thr - 0.05, thr + 0.06, L + (vnoise(x, y, 6 * k, seed + 3) - 0.5) * 0.2) * 0.96; if (m > 0) for (let c = 0; c < 3; c++) ch[c][i] += (255 - ch[c][i]) * m; }
  }
  // 5 pigment pools at the edge of dry washes (only in places)
  if (edge > 0) {
    const Bd = new Float32Array(N); for (let y = 0; y < th - 1; y++) for (let x = 0; x < tw - 1; x++) { const i = y * tw + x; if (lab[i] !== lab[i + 1] || lab[i] !== lab[i + tw]) Bd[i] = 1; }
    const E = blur(blur(Bd, Math.max(1, Math.round(1.4 * k))), Math.max(1, Math.round(1.4 * k)));
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = y * tw + x, e = E[i]; if (e < 0.01) continue; const G = smooth(0.25, 0.55, vnoise(x, y, 22 * k, seed + 5) * 0.6 + vnoise(x, y, 7 * k, seed + 6) * 0.4), a = Math.min(1, e * 3.2) * G * edge * 0.62;
      for (let c = 0; c < 3; c++) ch[c][i] = ch[c][i] * (1 - a) + (ch[c][i] * ch[c][i] / 255) * a;
    }
  }
  // 6 granulation + 7 mottling
  const gc = paper.grain * gran * 1.25;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x, Hp = paperHeight(pid, x, y, k, seed + 20), d = 1 - (0.299 * ch[0][i] + 0.587 * ch[1][i] + 0.114 * ch[2][i]) / 255, f = 1 - gc * (Hp - 0.5) * (0.25 + d);
    const n2 = vnoise(x, y, 60 * k, seed + 8) * 0.6 + vnoise(x, y, 20 * k, seed + 9) * 0.4, dens = 1 + (n2 - 0.5) * 0.5 * (0.25 + bloom);
    for (let c = 0; c < 3; c++) { const v = 255 - (255 - ch[c][i] * f) * dens; ch[c][i] = v < 0 ? 0 : v > 255 ? 255 : v; }
  }
  if (bloom > 0) { // backruns: pale centre, dark ragged ring
    const rnd = mulberry32((seed * 2654435761) >>> 0), n = Math.round(bloom * 6);
    for (let b = 0; b < n; b++) {
      const cx = rnd() * tw, cy = rnd() * th, rb = tw * (0.04 + 0.09 * rnd()), x0 = Math.max(0, Math.floor(cx - rb * 1.3)), x1 = Math.min(tw, Math.ceil(cx + rb * 1.3)), y0 = Math.max(0, Math.floor(cy - rb * 1.3)), y1 = Math.min(th, Math.ceil(cy + rb * 1.3)), s2 = seed + 100 + b;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const dd = Math.hypot(x - cx, y - cy) / (rb * (0.85 + 0.3 * vnoise(x, y, 0.06 * tw, s2))), i = y * tw + x, lift = (1 - smooth(0.55, 1, dd)) * 0.16 * bloom, ring = Math.exp(-(((dd - 0.98) / 0.07) ** 2)) * 0.2 * (0.6 + 0.6 * bloom);
        if (lift < 0.002 && ring < 0.002) continue; for (let c = 0; c < 3; c++) { let v = ch[c][i]; v += (255 - v) * lift; v *= 1 - ring; ch[c][i] = v; }
      }
    }
  }
  const out = new Uint8ClampedArray(N * 4), hm = spec.hue ? hueMatrix(spec.hue) : null;
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    let r = ch[0][i], g = ch[1][i], b = ch[2][i]; if (hm) { const r2 = hm[0] * r + hm[1] * g + hm[2] * b, g2 = hm[3] * r + hm[4] * g + hm[5] * b; b = hm[6] * r + hm[7] * g + hm[8] * b; r = r2; g = g2; }
    out[j] = r * pc[0] / 255; out[j + 1] = g * pc[1] / 255; out[j + 2] = b * pc[2] / 255; out[j + 3] = 255;
  }
  return out;
}
