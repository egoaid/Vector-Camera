// seg-stats.js - per-region statistics: robust colour (trimmed mean in Lab), centroid, texture, contrast, frame contact.
import { labToRgb } from './color-utils.js';
import { buildAdjacency } from './seg-merge.js';

export function computeRegionStats(labels, w, h, R, L, A, B, rgba) {
  const N = w * h, area = new Float64Array(R), off = new Int32Array(R + 1);
  for (let p = 0; p < N; p++) area[labels[p]]++;
  for (let r = 0; r < R; r++) off[r + 1] = off[r] + area[r];
  const pos = off.slice(0, R), idx = new Int32Array(N);
  for (let p = 0; p < N; p++) idx[pos[labels[p]]++] = p;
  const st = {
    R, area: Float32Array.from(area), cx: new Float32Array(R), cy: new Float32Array(R),
    bbox: new Int32Array(R * 4), lab: new Float32Array(R * 3), rgb: new Uint8Array(R * 3),
    texStd: new Float32Array(R), meanL: new Float32Array(R), chroma: new Float32Array(R),
    perim: new Float32Array(R), frameLen: new Float32Array(R), contrast: new Float32Array(R),
  };
  const tmp = [0, 0, 0];
  for (let r = 0; r < R; r++) {
    let sx = 0, sy = 0, mL = 0, mA = 0, mB = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    const s = off[r], e = off[r + 1], n = e - s;
    for (let i = s; i < e; i++) { const p = idx[i], x = p % w, y = (p / w) | 0; sx += x; sy += y; mL += L[p]; mA += A[p]; mB += B[p]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    mL /= n; mA /= n; mB /= n;
    let md = 0, vL = 0;
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = idx[s + i]; d[i] = Math.hypot(L[p] - mL, A[p] - mA, B[p] - mB); md += d[i]; vL += (L[p] - mL) ** 2; }
    md /= n; const thr = md * 1.6 + 1e-6; let tL = 0, tA = 0, tB = 0, tn = 0;
    for (let i = 0; i < n; i++) if (d[i] <= thr) { const p = idx[s + i]; tL += L[p]; tA += A[p]; tB += B[p]; tn++; }
    if (tn) { mL = tL / tn; mA = tA / tn; mB = tB / tn; }
    st.cx[r] = sx / n + 0.5; st.cy[r] = sy / n + 0.5;
    st.bbox.set([x0, y0, x1 + 1, y1 + 1], r * 4);
    st.lab.set([mL, mA, mB], r * 3); st.meanL[r] = mL / 100; st.chroma[r] = Math.hypot(mA, mB);
    st.texStd[r] = Math.sqrt(vL / n) / 100;
    labToRgb(mL, mA, mB, tmp); st.rgb.set(tmp, r * 3);
  }
  // perimeter / frame contact
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    const a = labels[p];
    if (x === 0) { st.perim[a]++; st.frameLen[a]++; } else if (labels[p - 1] !== a) st.perim[a]++;
    if (x === w - 1) { st.perim[a]++; st.frameLen[a]++; } else if (labels[p + 1] !== a) st.perim[a]++;
    if (y === 0) { st.perim[a]++; st.frameLen[a]++; } else if (labels[p - w] !== a) st.perim[a]++;
    if (y === h - 1) { st.perim[a]++; st.frameLen[a]++; } else if (labels[p + w] !== a) st.perim[a]++;
  }
  const adj = buildAdjacency(labels, w, h, R, null);
  for (let r = 0; r < R; r++) {
    let sw = 0, sd = 0;
    for (const [c, rec] of adj[r]) { const dd = Math.hypot(st.lab[r * 3] - st.lab[c * 3], st.lab[r * 3 + 1] - st.lab[c * 3 + 1], st.lab[r * 3 + 2] - st.lab[c * 3 + 2]); sw += rec.c; sd += rec.c * dd; }
    st.contrast[r] = sw ? sd / sw : 0;
  }
  st.adj = adj;
  return st;
}
