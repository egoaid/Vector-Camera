// seg-slic.js - SLIC superpixels in Lab space (stage A of the segmentation pipeline).
export function slic(L, A, B, w, h, { size = 12, compactness = 12, iters = 7 } = {}) {
  const N = w * h;
  const nx = Math.max(1, Math.round(w / size)), ny = Math.max(1, Math.round(h / size));
  const sx = w / nx, sy = h / ny, K = nx * ny, S = (sx + sy) / 2;
  const cx = new Float32Array(K), cy = new Float32Array(K), cl = new Float32Array(K), ca = new Float32Array(K), cb = new Float32Array(K);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i; cx[c] = (i + 0.5) * sx; cy[c] = (j + 0.5) * sy;
    const p = Math.min(h - 1, cy[c] | 0) * w + Math.min(w - 1, cx[c] | 0); cl[c] = L[p]; ca[c] = A[p]; cb[c] = B[p];
  }
  const labels = new Int32Array(N).fill(-1), dist = new Float32Array(N);
  const m2 = (compactness / S) * (compactness / S);
  const sum = new Float64Array(K * 6);
  for (let it = 0; it < iters; it++) {
    dist.fill(Infinity);
    for (let c = 0; c < K; c++) {
      const x0 = Math.max(0, Math.floor(cx[c] - sx)), x1 = Math.min(w - 1, Math.ceil(cx[c] + sx));
      const y0 = Math.max(0, Math.floor(cy[c] - sy)), y1 = Math.min(h - 1, Math.ceil(cy[c] + sy));
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy[c], dy2 = dy * dy * m2;
        for (let x = x0, p = y * w + x0; x <= x1; x++, p++) {
          const dl = L[p] - cl[c], da = A[p] - ca[c], db = B[p] - cb[c], dx = x - cx[c];
          const d = dl * dl + da * da + db * db + dx * dx * m2 + dy2;
          if (d < dist[p]) { dist[p] = d; labels[p] = c; }
        }
      }
    }
    sum.fill(0);
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
      const c = labels[p]; if (c < 0) continue; const o = c * 6;
      sum[o] += x; sum[o + 1] += y; sum[o + 2] += L[p]; sum[o + 3] += A[p]; sum[o + 4] += B[p]; sum[o + 5]++;
    }
    for (let c = 0; c < K; c++) { const o = c * 6, n = sum[o + 5]; if (n > 0) { cx[c] = sum[o] / n; cy[c] = sum[o + 1] / n; cl[c] = sum[o + 2] / n; ca[c] = sum[o + 3] / n; cb[c] = sum[o + 4] / n; } }
  }
  return enforceConnectivity(labels, w, h, Math.max(4, Math.round((sx * sy) / 4)));
}

/** Relabel into 4-connected components; tiny components are absorbed by a neighbour. Returns {labels, n}. */
export function enforceConnectivity(src, w, h, minSize) {
  const N = w * h, out = new Int32Array(N).fill(-1), stack = new Int32Array(N);
  let next = 0;
  for (let s = 0; s < N; s++) {
    if (out[s] >= 0) continue;
    const lab = src[s]; let adj = -1, sp = 0, cnt = 0;
    stack[sp++] = s; out[s] = next;
    const members = [];
    while (sp) {
      const p = stack[--sp]; members.push(p); cnt++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (let k = 0; k < 4; k++) {
        const q = nb[k]; if (q < 0) continue;
        if (out[q] >= 0) { if (out[q] !== next) adj = out[q]; continue; }
        if (src[q] === lab) { out[q] = next; stack[sp++] = q; }
      }
    }
    if (cnt < minSize && adj >= 0) for (const p of members) out[p] = adj; else next++;
  }
  // compact relabel (absorbed ids may leave gaps)
  const map = new Int32Array(next + 1).fill(-1); let n = 0;
  for (let p = 0; p < N; p++) { const v = out[p]; if (map[v] < 0) map[v] = n++; out[p] = map[v]; }
  return { labels: out, n };
}

/** Split superpixels along semantic label boundaries so every superpixel has exactly one semantic label. */
export function splitBySemantics(sp, w, h, semLabels, C) {
  const N = w * h, key = new Int32Array(N), map = new Map(); let n = 0;
  for (let p = 0; p < N; p++) { const k = sp.labels[p] * C + semLabels[p]; let id = map.get(k); if (id === undefined) { id = n++; map.set(k, id); } key[p] = id; }
  return enforceConnectivity(key, w, h, 3);
}
