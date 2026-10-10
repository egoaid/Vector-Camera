// pipeline-core.js - stage-cached segmentation + vectorisation pipeline (pure; runs in a Worker or on the main thread).
//  Stage A: SLIC superpixels            (key: size, compactness, semantic labels)
//  Stage B: merge dendrogram            (key: A + boundary sensitivity + semantic weight)
//  Stage C: cut + cleanup + palette     (key: B + k, minArea, keepContrast, paletteK)
//  Stage D: shared-boundary geometry    (key: C + shape params)
import { rgbaToLabPlanes, kmeansLab } from './color-utils.js';
import { slic, splitBySemantics } from './seg-slic.js';
import { edgeStrength } from './seg-edges.js';
import { buildDendrogram, cutDendrogram, cleanupSmall, relabel, buildAdjacency } from './seg-merge.js';
import { computeRegionStats } from './seg-stats.js';
import { regionSemantics } from './seg-saliency.js';
import { buildGeometry } from './vec-geometry.js';

export class Pipeline {
  constructor() { this.img = null; this.cache = {}; this.sem = null; this.semVersion = 0; }
  setImage(w, h, rgba) {
    this.img = { w, h, rgba }; this.cache = {};
    const t = rgbaToLabPlanes(rgba, w * h); this.lab = t; this.edge = edgeStrength(t.L, t.A, t.B, w, h);
  }
  setSemantic(sem) { this.sem = sem; this.semVersion++; this.cache.B = this.cache.A = null; this.cache.C = this.cache.D = null; }
  clearSemantic() { if (this.sem) { this.sem = null; this.semVersion++; this.cache = { ...this.cache, A: null, B: null, C: null, D: null }; } }

  process(p, onProgress = () => {}) {
    const { w, h } = this.img, { L, A, B } = this.lab, c = this.cache, t = {};
    const stage = (name, key, fn) => { if (c[name] && c[name].key === key) return false; const t0 = Date.now(); c[name] = { key, v: fn() }; t[name] = Date.now() - t0; return true; };
    const kA = `${w}x${h}|${p.spSize}|${p.compactness}|${this.semVersion}`;
    stage('A', kA, () => { onProgress('segment', 0.05); const sp = slic(L, A, B, w, h, { size: p.spSize, compactness: p.compactness }); return this.sem ? splitBySemantics(sp, w, h, this.sem.labels, this.sem.C) : sp; });
    const kB = `${kA}|${p.wEdge}|${p.semW}`;
    stage('B', kB, () => { onProgress('merge', 0.35); const sp = c.A.v; return buildDendrogram(sp.labels, w, h, sp.n, L, A, B, this.edge, { wEdge: p.wEdge, semW: p.semW }, this.sem); });
    const kC = `${kB}|${p.k}|${p.minArea}|${p.keepContrast}|${p.paletteK}`;
    stage('C', kC, () => {
      onProgress('regions', 0.55);
      const sp = c.A.v; let cut = cutDendrogram(sp.labels, w, h, c.B.v, p.k);
      cut = cleanupSmall(cut.labels, w, h, cut.R, L, A, B, { minArea: p.minArea, keepContrast: p.keepContrast });
      let labels = cut.labels, R = cut.R, st = computeRegionStats(labels, w, h, R, L, A, B, this.img.rgba), palIdx = null;
      if (p.paletteK > 0 && R > p.paletteK) {
        const pts = new Float64Array(R * 3), wt = new Float64Array(R);
        for (let r = 0; r < R; r++) { pts.set(st.lab.subarray(r * 3, r * 3 + 3), r * 3); wt[r] = st.area[r]; }
        const km = kmeansLab(pts, wt, R, p.paletteK, 7);
        // merge adjacent regions that share a palette entry (connected components over the region graph)
        const adj = buildAdjacency(labels, w, h, R, null), parent = new Int32Array(R).map((_, i) => i);
        const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
        for (let a = 0; a < R; a++) for (const b of adj[a].keys()) if (a < b && km.assign[a] === km.assign[b]) parent[find(b)] = find(a);
        const rl = relabel(labels, w * h, (s) => find(s), R);
        labels = rl.labels; const newR = rl.R; palIdx = new Int32Array(newR);
        const first = new Int32Array(newR).fill(-1);
        for (let p0 = 0; p0 < w * h; p0++) { const nr = labels[p0]; if (first[nr] < 0) first[nr] = km.assign[cut.labels[p0]]; }
        R = newR; palIdx = first;
        st = computeRegionStats(labels, w, h, R, L, A, B, this.img.rgba);
        // snap colours to palette centres for flat output
        for (let r = 0; r < R; r++) { const ci = palIdx[r]; st.lab[r * 3] = km.centers[ci * 3]; st.lab[r * 3 + 1] = km.centers[ci * 3 + 1]; st.lab[r * 3 + 2] = km.centers[ci * 3 + 2]; }
        recolor(st);
      }
      const semMajor = this.sem ? regionSemantics(labels, this.sem.labels, w * h, R, this.sem.C) : null;
      return { labels, R, st, palIdx, semMajor };
    });
    const kD = `${kC}|${JSON.stringify(p.shape)}`;
    stage('D', kD, () => { onProgress('vectorize', 0.8); const C = c.C.v; return buildGeometry(C.labels, w, h, C.R, p.shape); });
    onProgress('done', 1);
    const C = c.C.v, G = c.D.v, st = C.st;
    const { adj, ...stats } = st;
    return { w, h, R: C.R, labels: C.labels.slice(), stats, palIdx: C.palIdx, semMajor: C.semMajor, semNames: this.sem ? this.sem.names : null, geom: { w, h, R: G.R, chains: G.chains, loops: G.loops, stats: G.stats }, timings: t };
  }
}
import { labToRgb } from './color-utils.js';
function recolor(st) { const o = [0, 0, 0]; for (let r = 0; r < st.R; r++) { labToRgb(st.lab[r * 3], st.lab[r * 3 + 1], st.lab[r * 3 + 2], o); st.rgb.set(o, r * 3); st.meanL[r] = st.lab[r * 3] / 100; } }
