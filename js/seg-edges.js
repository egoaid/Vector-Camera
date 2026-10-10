// seg-edges.js - normalised edge-strength map (Lab Sobel). Used as evidence for boundary refinement.
export function edgeStrength(L, A, B, w, h) {
  const out = new Float32Array(w * h);
  const g = (p, q) => Math.hypot(L[p] - L[q], 0.6 * (A[p] - A[q]), 0.6 * (B[p] - B[q]));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    const xl = x > 0 ? p - 1 : p, xr = x < w - 1 ? p + 1 : p, yu = y > 0 ? p - w : p, yd = y < h - 1 ? p + w : p;
    out[p] = Math.hypot(g(xl, xr), g(yu, yd)) * 0.5;
  }
  // normalise by ~95th percentile (histogram on a subsample)
  const bins = new Uint32Array(512); let cnt = 0, mx = 0;
  for (let i = 0; i < out.length; i += 3) if (out[i] > mx) mx = out[i];
  mx = mx || 1;
  for (let i = 0; i < out.length; i += 3) { bins[Math.min(511, (out[i] / mx * 511) | 0)]++; cnt++; }
  let acc = 0, p95 = mx;
  for (let b = 0; b < 512; b++) { acc += bins[b]; if (acc >= cnt * 0.95) { p95 = ((b + 1) / 512) * mx; break; } }
  p95 = Math.max(p95, 1e-3);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / p95);
  return out;
}
