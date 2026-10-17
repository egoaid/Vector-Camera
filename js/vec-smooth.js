// vec-smooth.js - rounds the stair-stepped borders between regions into gentle curves BEFORE they are traced.
// Flat or gradient areas (sky, wall, skin) are cut out of superpixel squares, so their borders run in big square steps;
// a path fitter cannot remove steps that large. Here every region's mask is blurred and every pixel goes to the region
// with the strongest blurred mask (the border moves to where the blurred masks are equal = a rounded border).
// Pure typed-array code. Deterministic. Blur radius is in pixels of the label map; 0 = unchanged (same array returned).

function blurLocal(a, w, h, r) { // three box passes (near-Gaussian kernel, so circles stay round), in place on a w*h Float32Array
  const tmp = new Float32Array(w * h), n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let acc = 0; const o = y * w; for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[o + x] = acc / n; acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = acc / n; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  }
}

export function smoothLabels(labels, w, h, R, rad) {
  if (!(rad >= 1.2) || R < 2) return labels;
  const f = Math.max(2, Math.round(rad / 3)), gw = Math.ceil(w / f), gh = Math.ceil(h / f), r = Math.max(1, Math.round(rad / f)), pad = 2 * r + 2;
  const g = new Int32Array(gw * gh); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) g[y * gw + x] = labels[Math.min(h - 1, y * f + (f >> 1)) * w + Math.min(w - 1, x * f + (f >> 1))];
  const bx0 = new Int32Array(R).fill(1e9), by0 = new Int32Array(R).fill(1e9), bx1 = new Int32Array(R).fill(-1), by1 = new Int32Array(R).fill(-1);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const l = g[y * gw + x]; if (l < 0) continue; if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; }
  const maps = new Array(R).fill(null);
  for (let l = 0; l < R; l++) {
    if (bx1[l] < 0) continue;
    const x0 = Math.max(0, bx0[l] - pad), y0 = Math.max(0, by0[l] - pad), x1 = Math.min(gw - 1, bx1[l] + pad), y1 = Math.min(gh - 1, by1[l] + pad), mw = x1 - x0 + 1, mh = y1 - y0 + 1, m = new Float32Array(mw * mh);
    for (let y = by0[l]; y <= by1[l]; y++) for (let x = bx0[l]; x <= bx1[l]; x++) if (g[y * gw + x] === l) m[(y - y0) * mw + (x - x0)] = 1;
    blurLocal(m, mw, mh, r); maps[l] = { m, x0, y0, mw, mh };
  }
  const sample = (mp, fx, fy) => { // bilinear sample of a local map at grid coordinates (cell centres at integers); 0 outside
    const x = fx - mp.x0, y = fy - mp.y0; if (x < 0 || y < 0 || x > mp.mw - 1 || y > mp.mh - 1) return 0;
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, i1 = Math.min(mp.mw - 1, i + 1), j1 = Math.min(mp.mh - 1, j + 1), M = mp.m;
    return (M[j * mp.mw + i] * (1 - u) + M[j * mp.mw + i1] * u) * (1 - v) + (M[j1 * mp.mw + i] * (1 - u) + M[j1 * mp.mw + i1] * u) * v;
  };
  const out = new Int32Array(w * h), cand = new Int32Array(25);
  for (let y = 0; y < h; y++) {
    const fy = (y - (f >> 1)) / f, cy = Math.min(gh - 1, Math.max(0, Math.round(fy)));
    for (let x = 0; x < w; x++) {
      const fx = (x - (f >> 1)) / f, cx = Math.min(gw - 1, Math.max(0, Math.round(fx))); let nc = 0;
      for (let v = -2; v <= 2; v++) { const yy = cy + v; if (yy < 0 || yy >= gh) continue; for (let u = -2; u <= 2; u++) { const xx = cx + u; if (xx < 0 || xx >= gw) continue; const l = g[yy * gw + xx]; if (l < 0) continue; let seen = false; for (let q = 0; q < nc; q++) if (cand[q] === l) { seen = true; break; } if (!seen) cand[nc++] = l; } }
      const orig = labels[y * w + x];
      if (nc <= 1) { out[y * w + x] = nc === 1 ? cand[0] : orig; continue; }
      let best = orig, bs = -1; for (let q = 0; q < nc; q++) { const s = sample(maps[cand[q]], fx, fy) + (cand[q] === orig ? 1e-4 : 0); if (s > bs) { bs = s; best = cand[q]; } }
      out[y * w + x] = best;
    }
  }
  return out;
}
