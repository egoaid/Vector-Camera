// ink-dirt.js - "ink stains / bleed" and "ink spatter" over the WHOLE picture, usable with every mode (and part of the watercolour mode).
//  stain: ink that has wicked into the paper along the boundaries between colour areas: soft blotches in the colour of the area, with a darker pooled rim.
//  splat: droplets thrown from a few impact points: round drops, long streaky tails, tiny satellites, in the colours of the picture.
// Each effect is one RGBA bitmap (blend: multiply) in picture units. Pure typed-array code (no DOM); results are cached per input.
import { boxBlur, hash, vnoise } from './tone-photo.js';
import { mulberry32, hexToRgb } from './color-utils.js';

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1e-6))); return t * t * (3 - 2 * t); };
const cache = new Map(), LIMIT = 4, ids = new WeakMap(); let idn = 0;
const idOf = (o) => { if (!ids.has(o)) ids.set(o, ++idn); return ids.get(o); };

/**
 * res: pipeline result ({w,h,labels,R}); colors: array (per label) of '#rrggbb' or null; ink: '#rrggbb'.
 * p: { inkStain 0..100, inkSplat 0..100, inkSeed }.  -> [{ name, bitmap:{w,h,rgba,gx:0,gy:0,gw,gh}, color }] (empty when both are 0)
 */
export function inkDirtLayers(res, colors, ink, p, workLong = 1100) {
  const sn = Math.max(0, (p.inkStain || 0) / 100), sp = Math.max(0, (p.inkSplat || 0) / 100); if (!(sn > 0) && !(sp > 0)) return [];
  const key = [idOf(res.labels), sn, sp, p.inkSeed | 0, ink, workLong, colors.join(',')].join('|');
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const out = build(res, colors, ink, sn, sp, p.inkSeed | 0, workLong); cache.set(key, out); if (cache.size > LIMIT) cache.delete(cache.keys().next().value); return out;
}
export const clearInkDirtCache = () => cache.clear();

function build(res, colors, ink, sn, sp, seed0, workLong) {
  const gw0 = res.w, gh0 = res.h, long = Math.max(gw0, gh0), s = Math.min(1, workLong / long), W = Math.max(1, Math.round(gw0 * s)), H = Math.max(1, Math.round(gh0 * s)), N = W * H, k = Math.max(1, Math.max(W, H) / 1000), seed = seed0 + 7;
  const lab = new Int32Array(N); for (let y = 0; y < H; y++) { const sy = Math.min(gh0 - 1, Math.floor((y * gh0) / H)) * gw0; for (let x = 0; x < W; x++) lab[y * W + x] = res.labels[sy + Math.min(gw0 - 1, Math.floor((x * gw0) / W))]; }
  const inkC = hexToRgb(ink || '#17121c'), cols = colors.map((c) => (c ? hexToRgb(c) : null)), unit = Math.max(W, H);
  const mkBmp = (rgba) => ({ w: W, h: H, rgba, gx: 0, gy: 0, gw: gw0, gh: gh0 });
  const layers = [], blur2 = (A, r) => boxBlur(boxBlur(A, W, H, Math.max(1, r)), W, H, Math.max(1, r));
  if (sn > 0) {
    const Bd = new Float32Array(N); for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = y * W + x; if (lab[i] !== lab[i + 1] || lab[i] !== lab[i + W]) Bd[i] = 1; }
    const P = blur2(Bd, Math.round(unit * (0.004 + 0.012 * sn))), rgba = new Uint8ClampedArray(N * 4), thr = 0.7 - 0.2 * sn; let any = false, mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, P[i]); mx = mx || 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, pr = P[i] / mx; if (pr < 0.04) continue;
      const B = vnoise(x, y, 30 * k, seed + 40) * 0.7 + vnoise(x, y, 10 * k, seed + 50) * 0.3, body = smooth(thr, thr + 0.05, B) * smooth(0.04, 0.5, pr), rim = Math.max(0, 1 - Math.abs(B - (thr + 0.03)) / 0.025) * smooth(0.04, 0.4, pr);
      const fib = 0.75 + 0.25 * hash(x, y, seed + 60), a = Math.min(0.8, (body * 0.34 + rim * 0.4) * fib * (0.45 + 0.65 * sn)); if (a < 0.012) continue;
      const c = cols[lab[i]] || inkC, r = (c[0] * 0.65 + inkC[0] * 0.35), g = (c[1] * 0.65 + inkC[1] * 0.35), b = (c[2] * 0.65 + inkC[2] * 0.35), j = i * 4;
      rgba[j] = r * r / 255; rgba[j + 1] = g * g / 255; rgba[j + 2] = b * b / 255; rgba[j + 3] = Math.round(a * 255); any = true; // deeper than the area colour: pigment doubled where it pooled
    }
    if (any) layers.push({ name: 'ink-stain', bitmap: mkBmp(rgba), color: ink });
  }
  if (sp > 0) {
    const rnd = mulberry32((seed * 2654435761) >>> 0), A = new Float32Array(N), C = new Uint8Array(N * 3); let any = false;
    const area = new Map(); for (let i = 0; i < N; i += 7) if (cols[lab[i]]) area.set(lab[i], (area.get(lab[i]) || 0) + 1);
    const pal = [...area.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => cols[l]); pal.push(inkC, inkC);
    const nc = 2 + Math.round(4 * sp), per = Math.round((25 + 260 * sp) / nc);
    for (let c = 0; c < nc; c++) {
      const cx = rnd() * W, cy = rnd() * H, col = pal[Math.floor(rnd() * pal.length)], reach = unit * (0.1 + 0.22 * sp);
      for (let d = 0; d < per; d++) {
        const ang = rnd() * Math.PI * 2, dist = reach * (-Math.log(1 - rnd() * 0.97)) * (0.25 + 0.5 * rnd()), x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist;
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        const near = 1 - Math.min(1, dist / (reach * 1.6)), r = unit * (0.0005 + 0.0052 * Math.pow(rnd(), 3.8)) * (0.7 + 0.8 * sp) * (0.6 + 0.8 * near), rr = Math.max(0.9, r), streak = rnd() < 0.35 ? 1.6 + 3 * rnd() * (1 - near * 0.5) : 1;
        const a0 = Math.atan2(y - cy, x - cx) + (rnd() - 0.5) * 0.3, ca = Math.cos(a0), sa = Math.sin(a0), ex = rr * streak, ext = Math.ceil(Math.max(ex, rr)) + 2, al = 0.6 + 0.35 * rnd(), cc = rnd() < 0.8 ? col : pal[Math.floor(rnd() * pal.length)];
        for (let yy = Math.max(0, Math.floor(y - ext)); yy < Math.min(H, Math.ceil(y + ext)); yy++) for (let xx = Math.max(0, Math.floor(x - ext)); xx < Math.min(W, Math.ceil(x + ext)); xx++) {
          const dx = xx + 0.5 - x, dy = yy + 0.5 - y, u = (dx * ca + dy * sa) / ex, v = (-dx * sa + dy * ca) / rr, q = Math.sqrt(u * u + v * v); if (q > 1.15) continue;
          const a = al * (1 - smooth(0.78, 1.0, q)) * (streak > 1 ? 1 - 0.55 * Math.max(0, u) : 1), i = yy * W + xx;
          if (a > A[i]) { A[i] = a; C[i * 3] = cc[0] * cc[0] / 255; C[i * 3 + 1] = cc[1] * cc[1] / 255; C[i * 3 + 2] = cc[2] * cc[2] / 255; any = true; }
        }
      }
    }
    if (any) { const rgba = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { const a = A[i]; if (a < 0.012) continue; const j = i * 4; rgba[j] = C[i * 3]; rgba[j + 1] = C[i * 3 + 1]; rgba[j + 2] = C[i * 3 + 2]; rgba[j + 3] = Math.round(Math.min(1, a) * 255); } layers.push({ name: 'ink-splat', bitmap: mkBmp(rgba), color: ink }); }
  }
  return layers;
}
