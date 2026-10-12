// seg-merge.js - region adjacency graph + greedy hierarchical merge (dendrogram), cut at any region count.
export function buildAdjacency(labels, w, h, n, edge) {
  const adj = Array.from({ length: n }, () => new Map());
  const add = (a, b, e) => {
    if (a === b) return;
    let r = adj[a].get(b);
    if (!r) { r = { c: 0, e: 0 }; adj[a].set(b, r); adj[b].set(a, r); }
    r.c++; r.e += e;
  };
  for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
    const a = labels[p];
    if (x + 1 < w) { const b = labels[p + 1]; if (a !== b) add(a, b, edge ? Math.max(edge[p], edge[p + 1]) : 0); }
    if (y + 1 < h) { const b = labels[p + w]; if (a !== b) add(a, b, edge ? Math.max(edge[p], edge[p + w]) : 0); }
  }
  return adj;
}

class Heap {
  constructor() { this.a = []; }
  push(it) { const a = this.a; a.push(it); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= a[i].cost) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a; if (!a.length) return null; const top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l].cost < a[m].cost) m = l; if (r < a.length && a[r].cost < a[m].cost) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

/**
 * Greedy merge of superpixels. Cost = colour distance of region means, scaled by boundary edge
 * strength (wEdge) and a mild size term; cross-semantic-label merges are postponed (semW).
 * sem: { labels:Uint8Array|Int32Array(w*h), C } or null.
 */
export function buildDendrogram(sp, w, h, n, L, A, B, edge, { wEdge = 0.5, semW = 0.8 } = {}, sem = null) {
  const area = new Float64Array(n), sL = new Float64Array(n), sA = new Float64Array(n), sB = new Float64Array(n);
  for (let p = 0; p < w * h; p++) { const s = sp[p]; area[s]++; sL[s] += L[p]; sA[s] += A[p]; sB[s] += B[p]; }
  const adj = buildAdjacency(sp, w, h, n, edge);
  let semCnt = null, semMaj = null; const C = sem ? sem.C : 0;
  if (sem) {
    semCnt = new Int32Array(n * C); semMaj = new Int32Array(n);
    for (let p = 0; p < w * h; p++) semCnt[sp[p] * C + sem.labels[p]]++;
    for (let s = 0; s < n; s++) semMaj[s] = majority(semCnt, s, C);
  }
  const A0 = (w * h) / n, alive = new Uint8Array(n).fill(1), ver = new Int32Array(n);
  const cost = (a, b, r) => {
    const dl = sL[a] / area[a] - sL[b] / area[b], da = sA[a] / area[a] - sA[b] / area[b], db = sB[a] / area[a] - sB[b] / area[b];
    const dE = Math.sqrt(dl * dl + da * da + db * db);
    const sizeF = Math.pow(Math.max(0.15, Math.min(area[a], area[b]) / A0), 0.3);
    const ef = 1 + wEdge * 3 * Math.min(1, r.e / Math.max(1, r.c));
    let c = (dE + 0.05) * sizeF * ef;
    if (sem && semMaj[a] !== semMaj[b]) c = c * (1 + semW * 6) + semW * 30 + (semW >= 0.99 ? 1e4 : 0); // semW=1: never merge across detected-labels until forced
    return c;
  };
  const heap = new Heap();
  for (let a = 0; a < n; a++) for (const [b, r] of adj[a]) if (a < b) heap.push({ cost: cost(a, b, r), a, b, va: 0, vb: 0 });
  const mA = [], mB = [], mC = [];
  while (heap.size) {
    const it = heap.pop();
    const { a, b } = it;
    if (!alive[a] || !alive[b] || ver[a] !== it.va || ver[b] !== it.vb) continue;
    area[a] += area[b]; sL[a] += sL[b]; sA[a] += sA[b]; sB[a] += sB[b];
    if (sem) { for (let c = 0; c < C; c++) semCnt[a * C + c] += semCnt[b * C + c]; semMaj[a] = majority(semCnt, a, C); }
    adj[a].delete(b); adj[b].delete(a);
    for (const [c, r] of adj[b]) {
      adj[c].delete(b);
      const ra = adj[a].get(c);
      if (ra) { ra.c += r.c; ra.e += r.e; } else { adj[a].set(c, r); adj[c].set(a, r); }
    }
    adj[b].clear(); alive[b] = 0; ver[a]++;
    mA.push(a); mB.push(b); mC.push(it.cost);
    for (const [c, r] of adj[a]) heap.push({ cost: cost(a, c, r), a: Math.min(a, c), b: Math.max(a, c), va: ver[Math.min(a, c)], vb: ver[Math.max(a, c)] });
  }
  return { n, mergesA: Int32Array.from(mA), mergesB: Int32Array.from(mB), cost: Float32Array.from(mC), count: mA.length, semMaj };
}
function majority(cnt, s, C) { let best = 0, bv = -1; for (let c = 0; c < C; c++) { const v = cnt[s * C + c]; if (v > bv) { bv = v; best = c; } } return best; }

/** Apply merges until k regions remain. Returns {labels (compact 0..R-1), R}. */
export function cutDendrogram(sp, w, h, dend, k) {
  const n = dend.n, parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const apply = Math.max(0, Math.min(dend.count, n - Math.max(1, k)));
  for (let i = 0; i < apply; i++) parent[find(dend.mergesB[i])] = find(dend.mergesA[i]);
  const map = new Int32Array(n).fill(-1); let R = 0;
  const spToRegion = new Int32Array(n);
  for (let s = 0; s < n; s++) { const r = find(s); if (map[r] < 0) map[r] = R++; spToRegion[s] = map[r]; }
  const labels = new Int32Array(w * h);
  for (let p = 0; p < w * h; p++) labels[p] = spToRegion[sp[p]];
  return { labels, R, spToRegion };
}

/** Merge small regions into their closest-coloured neighbour unless they are distinct (keepContrast). */
export function cleanupSmall(labels, w, h, R, L, A, B, { minArea = 20, keepContrast = 28 } = {}) {
  const adj = buildAdjacency(labels, w, h, R, null);
  const area = new Float64Array(R), sL = new Float64Array(R), sA = new Float64Array(R), sB = new Float64Array(R);
  for (let p = 0; p < w * h; p++) { const s = labels[p]; area[s]++; sL[s] += L[p]; sA[s] += A[p]; sB[s] += B[p]; }
  const parent = new Int32Array(R); for (let i = 0; i < R; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const order = Array.from({ length: R }, (_, i) => i).sort((a, b) => area[a] - area[b]);
  for (const r of order) {
    if (parent[r] !== r || area[r] >= minArea || !adj[r].size) continue;
    let best = -1, bd = Infinity;
    for (const [c, rec] of adj[r]) {
      const dl = sL[r] / area[r] - sL[c] / area[c], da = sA[r] / area[r] - sA[c] / area[c], db = sB[r] / area[r] - sB[c] / area[c];
      const d = Math.sqrt(dl * dl + da * da + db * db) - rec.c * 0.02;
      if (d < bd) { bd = d; best = c; }
    }
    if (best < 0 || (bd > keepContrast && area[r] >= 3)) continue;
    area[best] += area[r]; sL[best] += sL[r]; sA[best] += sA[r]; sB[best] += sB[r]; parent[r] = best;
    adj[best].delete(r);
    for (const [c, rec] of adj[r]) { adj[c].delete(r); if (c === best) continue; const ex = adj[best].get(c); if (ex) { ex.c += rec.c; } else { adj[best].set(c, rec); adj[c].set(best, rec); } }
    adj[r].clear();
  }
  return relabel(labels, w * h, (s) => find(s), R);
}

/** Relabel through a mapping function and compact ids. */
export function relabel(labels, N, mapFn, R) {
  const m = new Int32Array(R).fill(-1), root = new Int32Array(R); let n = 0;
  for (let s = 0; s < R; s++) { const r = mapFn(s); root[s] = r; }
  const id = new Int32Array(R).fill(-1);
  for (let s = 0; s < R; s++) { const r = root[s]; if (id[r] < 0) id[r] = n++; m[s] = id[r]; }
  const out = new Int32Array(N); for (let p = 0; p < N; p++) out[p] = m[labels[p]];
  return { labels: out, R: n };
}
