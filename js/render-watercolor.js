// render-watercolor.js - the "watercolour" mode: the photo painted with a brush, translucent patches layered on real paper.
// Steps (all typed-array code, no DOM; paint is kept as optical density, see wc-strokes.js):
//  1 pigment     photo colours as density, with more chroma (watercolour pigments are cleaner than the real world) but not more density
//  2 gaps        bare paper just inside the boundary of some colour faces, only in places (wc-field.js)
//  3 under-wash  a thin, broken first wash: flat colour of each face mixed with a little of the blurred photo
//  4 strokes     brush patches, broad to small, layered; the amount of layering and the brush size are settings (wc-strokes.js)
//  5 lightness   transparency: the whole painting is lifted toward the paper
//  6 wet bleed   in a few wet places colours run into each other
//  7 granulation pigment settles into the fine tooth of the paper; mottling = small uneven density and small "blooms" (backruns)
// The result is multiplied by the paper colour. Returns RGBA bytes (opaque).
import { boxBlur, hash, vnoise } from './tone-photo.js';
import { hexToRgb, mulberry32, hueMatrix } from './color-utils.js';
import { orientationField, boundaryDistance, regionContrast, gapField, refineLabels, modeFilter } from './wc-field.js';
import { paintStrokes, noiseTile } from './wc-strokes.js';

export const PAPERS = {
  hot: { color: '#fbf8f1', grain: 0.35, amount: 0.12 },   // smooth hot-pressed: fine tooth, little granulation
  cold: { color: '#f7f2e8', grain: 0.7, amount: 0.3 },    // cold-pressed: the classic medium tooth
  tinted: { color: '#eadfc8', grain: 0.7, amount: 0.3 },  // cream / buff paper
};
export const PAPER_IDS = Object.keys(PAPERS);
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
const SAT = 1.3; // chroma of the pigment: the spread of the channel densities is stretched by this, their mean (how dark it is) is not

/** Height of the paper surface in [0,1] (valleys low), a FINE tooth: the cells are only a pixel or two wide. */
function paperHeight(id, x, y, k, seed) {
  if (id === 'hot') return hash(x, y, seed) * 0.6 + vnoise(x, y, 1.2 * k, seed + 1) * 0.4;
  return hash(x, y, seed) * 0.4 + vnoise(x, y, 1.1 * k, seed + 1) * 0.35 + vnoise(x, y, 2.4 * k, seed + 2) * 0.25;
}
const dens = (v) => -Math.log(Math.max(10, Math.min(255, v)) / 255);

/** img {w,h,data RGBA}, lab Int32Array(w*h) region ids, stats {rgb} (0..255 per region), spec {bleed,edge,gran,light,hl,bloom,brush,layer 0..100, paper id, seed}. */
export function watercolorBitmap(img, lab0, stats, spec) {
  const tw = img.w, th = img.h, N = tw * th, data = img.data, long = Math.max(tw, th), k = Math.max(1, long / 1000), seed = (spec.seed | 0) + 13;
  const f01 = (v, d) => Math.max(0, Math.min(100, v ?? d)) / 100, bleed = f01(spec.bleed, 45), edge = f01(spec.edge, 50), gran = f01(spec.gran, 50), light = f01(spec.light, 30), hl = f01(spec.hl, 40), bloom = f01(spec.bloom, 35), brush = f01(spec.brush, 50), layer = f01(spec.layer, 50);
  const pid = PAPERS[spec.paper] ? spec.paper : 'cold', paper = PAPERS[pid], pc = hexToRgb(paper.color), rgb = stats.rgb, rnd = mulberry32((seed * 2654435761) >>> 0);
  const blur = (A, r) => boxBlur(A, tw, th, Math.max(1, r)), mk = () => [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const pr = mk(); for (let i = 0, j = 0; i < N; i++, j += 4) { pr[0][i] = data[j]; pr[1][i] = data[j + 1]; pr[2][i] = data[j + 2]; }
  const rs = Math.max(1, Math.round(0.003 * long)), ps = pr.map((A) => blur(A, rs)), field = orientationField(pr, tw, th);
  const dist0 = boundaryDistance(lab0, tw, th, 0.03 * long), reach = 0.012 * long, nL = rgb.length / 3, mr = Math.max(2, Math.round(0.003 * long)); // faces with edges that follow the photo (and are not ragged)
  const lab = modeFilter(refineLabels(lab0, ps, rgb, tw, th, dist0, reach), tw, th, dist0, reach * 1.2, mr, nL);
  // 1 pigment density of the photo (chroma stretched, darkness kept)
  const Dp = mk(), sat = (a, b, c, o, i) => { const m = (a + b + c) / 3; o[0][i] = Math.max(0, m + (a - m) * SAT); o[1][i] = Math.max(0, m + (b - m) * SAT); o[2][i] = Math.max(0, m + (c - m) * SAT); };
  for (let i = 0; i < N; i++) sat(dens(ps[0][i]), dens(ps[1][i]), dens(ps[2][i]), Dp, i);
  // 2 gaps of bare paper next to the boundaries of colour faces
  const dist = boundaryDistance(lab, tw, th, 0.08 * long), open = hl > 0 ? gapField(lab, dist, regionContrast(lab, tw, th, rgb), tw, th, k, hl, seed + 30, rnd) : null;
  // 3 under-wash: thin and broken
  const D = mk(), pb = pr.map((A) => blur(A, Math.max(2, Math.round(0.008 * tw)))), tmp = mk();
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x, l = lab[i]; sat(dens(rgb[l * 3] * 0.55 + pb[0][i] * 0.45), dens(rgb[l * 3 + 1] * 0.55 + pb[1][i] * 0.45), dens(rgb[l * 3 + 2] * 0.55 + pb[2][i] * 0.45), tmp, i);
    const w = 0.3 * (0.55 + 0.45 * smooth(0.25, 0.75, vnoise(x, y, 0.05 * long, seed + 40))) * (open ? open[i] : 1);
    D[0][i] = tmp[0][i] * w; D[1][i] = tmp[1][i] * w; D[2][i] = tmp[2][i] * w;
  }
  tmp.length = 0; pb.length = 0;
  // 4 strokes
  paintStrokes({ tw, th, long, k, lab, ps, Dp, field, open, D, rnd, tile: noiseTile(seed + 50), seed: seed + 60, hand: -0.95 + (rnd() - 0.5) * 0.6 }, { brush, layer, edge, bleed, hl });
  // keep the overall density where the photo has it (more overlap must not mean a darker picture), then 5 lightness
  let sd = 0, sp = 0; for (let i = 0; i < N; i++) { if (open && open[i] < 0.99) continue; sd += D[0][i] + D[1][i] + D[2][i]; sp += Dp[0][i] + Dp[1][i] + Dp[2][i]; }
  const gain = Math.max(0.55, Math.min(1.7, sp / (sd || 1))) * (1 - 0.55 * light) * 0.9;
  for (let c = 0; c < 3; c++) for (let i = 0; i < N; i++) D[c][i] *= gain;
  // 6 wet bleed in a few places
  if (bleed > 0) {
    const rb = Math.max(1, Math.round((0.0015 + 0.01 * bleed) * long)), bl = D.map((A) => blur(blur(A, rb), rb));
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const i = y * tw + x, w = (0.12 + 0.88 * smooth(0.3, 0.7, vnoise(x, y, 0.1 * long, seed + 70))) * bleed * 0.7; for (let c = 0; c < 3; c++) D[c][i] += (bl[c][i] - D[c][i]) * w; }
  }
  // 7 granulation (fine) + mottling (small)
  const gc = paper.grain * gran * 1.1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = y * tw + x, Hp = paperHeight(pid, x, y, k, seed + 20), dm = Math.min(1, (D[0][i] + D[1][i] + D[2][i]) / 3), f = 1 + gc * (0.5 - Hp) * 2 * (0.2 + dm);
    const n2 = vnoise(x, y, 10 * k, seed + 8) * 0.55 + vnoise(x, y, 3.5 * k, seed + 9) * 0.45, md = 1 + (n2 - 0.5) * 0.55 * (0.3 + bloom);
    for (let c = 0; c < 3; c++) D[c][i] *= f * md;
  }
  if (bloom > 0) { // small backruns: pale centre, thin darker ring
    const n = Math.max(2, Math.round(bloom * 34 * (N / 700000)));
    for (let b = 0; b < n; b++) {
      const cx = rnd() * tw, cy = rnd() * th, rb = long * (0.005 + 0.014 * rnd()), x0 = Math.max(0, Math.floor(cx - rb * 1.3)), x1 = Math.min(tw, Math.ceil(cx + rb * 1.3)), y0 = Math.max(0, Math.floor(cy - rb * 1.3)), y1 = Math.min(th, Math.ceil(cy + rb * 1.3)), s2 = seed + 100 + b;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const dd = Math.hypot(x - cx, y - cy) / (rb * (0.85 + 0.3 * vnoise(x, y, rb * 0.5, s2))), i = y * tw + x, lift = (1 - smooth(0.5, 1, dd)) * 0.22 * bloom, ring = Math.exp(-(((dd - 0.97) / 0.1) ** 2)) * 0.35 * (0.6 + 0.6 * bloom);
        if (lift < 0.003 && ring < 0.003) continue; for (let c = 0; c < 3; c++) D[c][i] = D[c][i] * (1 - lift) * (1 + ring);
      }
    }
  }
  const out = new Uint8ClampedArray(N * 4), hm = spec.hue ? hueMatrix(spec.hue) : null, DM = 2;
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    let r = 255 * Math.exp(-DM * (1 - Math.exp(-D[0][i] / DM))), g = 255 * Math.exp(-DM * (1 - Math.exp(-D[1][i] / DM))), b = 255 * Math.exp(-DM * (1 - Math.exp(-D[2][i] / DM)));
    if (hm) { const r2 = hm[0] * r + hm[1] * g + hm[2] * b, g2 = hm[3] * r + hm[4] * g + hm[5] * b; b = hm[6] * r + hm[7] * g + hm[8] * b; r = r2; g = g2; }
    out[j] = r * pc[0] / 255; out[j + 1] = g * pc[1] / 255; out[j + 2] = b * pc[2] / 255; out[j + 3] = 255;
  }
  return out;
}
