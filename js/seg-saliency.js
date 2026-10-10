// seg-saliency.js - heuristic foreground / mid / background grouping of regions (0=bg,1=mid,2=fg).
import { groupHint } from './seg-semantic.js';
export function classifyGroups(st, w, h, { subjectSize = 0.3, semNames = null, semMajor = null, overrides = [], labels = null } = {}) {
  const R = st.R, score = new Float32Array(R), grp = new Uint8Array(R).fill(0);
  const diag = Math.hypot(w, h) / 2, total = w * h;
  let maxC = 1, maxCh = 1; for (let r = 0; r < R; r++) { maxC = Math.max(maxC, st.contrast[r]); maxCh = Math.max(maxCh, st.chroma[r]); }
  for (let r = 0; r < R; r++) {
    const center = 1 - Math.min(1, Math.hypot(st.cx[r] - w / 2, st.cy[r] - h / 2) / diag);
    const frameFrac = st.perim[r] ? st.frameLen[r] / st.perim[r] : 0, af = st.area[r] / total;
    score[r] = 0.35 * center + 0.3 * (st.contrast[r] / maxC) + 0.2 * (1 - Math.min(1, frameFrac * 2)) + 0.15 * (st.chroma[r] / maxCh) - (af > 0.45 ? 0.3 : 0);
  }
  const order = Array.from({ length: R }, (_, i) => i).sort((a, b) => score[b] - score[a]);
  let acc = 0; const fg = new Uint8Array(R);
  for (const r of order) { if (acc >= subjectSize * total) break; if (st.area[r] / total > 0.6) continue; fg[r] = 1; acc += st.area[r]; }
  for (let r = 0; r < R; r++) {
    const frameFrac = st.perim[r] ? st.frameLen[r] / st.perim[r] : 0;
    grp[r] = fg[r] ? 2 : (frameFrac > 0.25 || st.area[r] / total > 0.2 ? 0 : 1);
    if (semNames && semMajor) { const hnt = groupHint(semNames[semMajor[r]]); if (hnt >= 0) grp[r] = hnt; }
  }
  if (labels) for (const o of overrides) { const x = Math.max(0, Math.min(w - 1, o.x | 0)), y = Math.max(0, Math.min(h - 1, o.y | 0)); grp[labels[y * w + x]] = o.g; }
  return grp;
}
/** Majority semantic label per final region (for hints). */
export function regionSemantics(labels, semLabels, N, R, C) {
  if (!semLabels) return null;
  const cnt = new Int32Array(R * C);
  for (let p = 0; p < N; p++) cnt[labels[p] * C + semLabels[p]]++;
  const maj = new Int32Array(R);
  for (let r = 0; r < R; r++) { let b = 0, bv = -1; for (let c = 0; c < C; c++) if (cnt[r * C + c] > bv) { bv = cnt[r * C + c]; b = c; } maj[r] = b; }
  return maj;
}
