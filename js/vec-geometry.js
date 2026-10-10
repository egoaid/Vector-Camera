// vec-geometry.js - builds shared-boundary vector geometry for a label map and serialises regions to path data.
import { traceBoundaries } from './vec-chains.js';
import { fitChain, reversePath, pinEnds } from './vec-curves.js';

/** prm: { smooth, eps, fitErr, cornerDeg, angular }. Returns geometry { w,h,R,chains[],loops[][] , stats }. */
export function buildGeometry(labels, w, h, R, prm) {
  const { chains: raw } = traceBoundaries(labels, w, h);
  const chains = raw.map((c) => {
    const path = fitChain(c.xy, c.closed, prm), n = c.xy.length;
    pinEnds(path, c.xy[0], c.xy[1], c.xy[n - 2], c.xy[n - 1]);
    return { path, left: c.left, right: c.right, sv: c.sv, ev: c.ev };
  });
  const out = Array.from({ length: R }, () => new Map());
  const push = (r, v, it) => { const m = out[r]; const l = m.get(v); if (l) l.push(it); else m.set(v, [it]); };
  chains.forEach((c, ci) => { if (c.left >= 0) push(c.left, c.sv, { ci, f: 1 }); if (c.right >= 0) push(c.right, c.ev, { ci, f: 0 }); });
  const used = new Uint8Array(chains.length * 2), loops = [];
  let broken = 0;
  for (let r = 0; r < R; r++) {
    const rl = [];
    for (const list of out[r].values()) for (const first of list) {
      if (used[first.ci * 2 + first.f]) continue;
      const loop = []; let cur = first; const startV = first.f ? chains[first.ci].sv : chains[first.ci].ev;
      for (;;) {
        used[cur.ci * 2 + cur.f] = 1; loop.push(cur.ci * 2 + cur.f);
        const endV = cur.f ? chains[cur.ci].ev : chains[cur.ci].sv;
        if (endV === startV) break;
        const nxt = (out[r].get(endV) || []).find((it) => !used[it.ci * 2 + it.f]);
        if (!nxt) { broken++; break; }
        cur = nxt;
      }
      rl.push(Int32Array.from(loop));
    }
    loops.push(rl);
  }
  return { w, h, R, chains: chains.map((c) => c.path), loops, stats: { chains: chains.length, broken } };
}

const fmt = (v, p) => { const s = v.toFixed(p); return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); };

/** Path data (SVG syntax) for one region. Used directly by SVG and Canvas (Path2D). */
export function regionPathD(geom, r, { scale = 1, prec = 2, dx = 0, dy = 0 } = {}) {
  geom._rev ||= new Map();
  const get = (code) => {
    const ci = code >> 1;
    if (code & 1) return geom.chains[ci];
    let p = geom._rev.get(ci); if (!p) { p = reversePath(geom.chains[ci]); geom._rev.set(ci, p); } return p;
  };
  let d = '';
  const X = (v) => fmt(v * scale + dx, prec), Y = (v) => fmt(v * scale + dy, prec);
  for (const loop of geom.loops[r]) {
    let first = true;
    for (const code of loop) {
      const p = get(code), { cmds, pts } = p;
      if (first) { d += `M${X(pts[0])} ${Y(pts[1])}`; first = false; }
      let o = 2;
      for (let i = 0; i < cmds.length; i++) {
        if (cmds[i] === 3) { d += `C${X(pts[o])} ${Y(pts[o + 1])} ${X(pts[o + 2])} ${Y(pts[o + 3])} ${X(pts[o + 4])} ${Y(pts[o + 5])}`; o += 6; }
        else { d += `L${X(pts[o])} ${Y(pts[o + 1])}`; o += 2; }
      }
    }
    d += 'Z';
  }
  return d;
}
/** Combined path data for several regions (a group / clip path). */
export function groupPathD(geom, regionIds, opts) { let d = ''; for (const r of regionIds) d += regionPathD(geom, r, opts); return d; }

/** Signed polygon area of one region (Beziers flattened) - used by tests to verify topology. */
export function regionArea(geom, r, steps = 12) {
  geom._rev ||= new Map(); let area = 0;
  for (const loop of geom.loops[r]) {
    const P = [];
    for (const code of loop) {
      const ci = code >> 1; let p = geom.chains[ci];
      if (!(code & 1)) { let q = geom._rev.get(ci); if (!q) { q = reversePath(p); geom._rev.set(ci, q); } p = q; }
      const { cmds, pts } = p; let cx = pts[0], cy = pts[1], o = 2; P.push([cx, cy]);
      for (let i = 0; i < cmds.length; i++) {
        if (cmds[i] === 3) { for (let s = 1; s <= steps; s++) { const t = s / steps, m = 1 - t; P.push([m * m * m * cx + 3 * m * m * t * pts[o] + 3 * m * t * t * pts[o + 2] + t * t * t * pts[o + 4], m * m * m * cy + 3 * m * m * t * pts[o + 1] + 3 * m * t * t * pts[o + 3] + t * t * t * pts[o + 5]]); } cx = pts[o + 4]; cy = pts[o + 5]; o += 6; }
        else { cx = pts[o]; cy = pts[o + 1]; P.push([cx, cy]); o += 2; }
      }
    }
    let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; }
    area += a / 2;
  }
  return area;
}
