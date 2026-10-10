// vec-curves.js - Taubin smoothing, Douglas-Peucker simplification, corner detection and Schneider cubic Bezier fitting.
// A fitted path: { cmds: Uint8Array (1=line,3=cubic), pts: Float32Array [x0,y0, then 2 or 6 numbers per cmd] }.

function taubin(x, y, closed, pairs) {
  const n = x.length; if (n < 3 || pairs <= 0) return;
  const nx = new Float64Array(n), ny = new Float64Array(n);
  for (let it = 0; it < pairs * 2; it++) {
    const k = it % 2 === 0 ? 0.5 : -0.52;
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) { nx[i] = x[i]; ny[i] = y[i]; continue; }
      const a = i === 0 ? n - 1 : i - 1, b = i === n - 1 ? 0 : i + 1;
      nx[i] = x[i] + k * ((x[a] + x[b]) / 2 - x[i]); ny[i] = y[i] + k * ((y[a] + y[b]) / 2 - y[i]);
    }
    x.set(nx); y.set(ny);
  }
}
function dp(x, y, i0, i1, eps, keep) {
  const st = [[i0, i1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = -1, mi = -1;
    const dx = x[b] - x[a], dy = y[b] - y[a], L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((x[i] - x[a]) * dy - (y[i] - y[a]) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
}
const norm = (vx, vy) => { const l = Math.hypot(vx, vy) || 1; return [vx / l, vy / l]; };

// ---- Schneider cubic fitting (Graphics Gems) ----
function bez(p, t) { const m = 1 - t; return [m * m * m * p[0] + 3 * m * m * t * p[2] + 3 * m * t * t * p[4] + t * t * t * p[6], m * m * m * p[1] + 3 * m * m * t * p[3] + 3 * m * t * t * p[5] + t * t * t * p[7]]; }
function fitCubic(X, Y, a, b, t1, t2, err2, out, depth = 0) {
  const n = b - a + 1;
  if (n === 2) { const d = Math.hypot(X[b] - X[a], Y[b] - Y[a]) / 3; out.push([X[a], Y[a], X[a] + t1[0] * d, Y[a] + t1[1] * d, X[b] + t2[0] * d, Y[b] + t2[1] * d, X[b], Y[b]]); return; }
  let u = new Float64Array(n); for (let i = 1; i < n; i++) u[i] = u[i - 1] + Math.hypot(X[a + i] - X[a + i - 1], Y[a + i] - Y[a + i - 1]);
  for (let i = 1; i < n; i++) u[i] /= u[n - 1] || 1;
  let p = gen(X, Y, a, b, u, t1, t2), [me, sp] = maxErr(X, Y, a, b, p, u);
  if (me < err2) { out.push(p); return; }
  if (me < err2 * 16) for (let k = 0; k < 4; k++) {
    u = reparam(X, Y, a, b, u, p); p = gen(X, Y, a, b, u, t1, t2); [me, sp] = maxErr(X, Y, a, b, p, u);
    if (me < err2) { out.push(p); return; }
  }
  if (depth > 24 || sp <= a || sp >= b) { out.push(p); return; }
  const tc = norm(X[sp - 1] - X[sp + 1], Y[sp - 1] - Y[sp + 1]);
  fitCubic(X, Y, a, sp, t1, tc, err2, out, depth + 1);
  fitCubic(X, Y, sp, b, [-tc[0], -tc[1]], t2, err2, out, depth + 1);
}
function gen(X, Y, a, b, u, t1, t2) {
  const n = b - a + 1, p0x = X[a], p0y = Y[a], p3x = X[b], p3y = Y[b];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i], m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
    const a1x = t1[0] * b1, a1y = t1[1] * b1, a2x = t2[0] * b2, a2y = t2[1] * b2;
    c00 += a1x * a1x + a1y * a1y; c01 += a1x * a2x + a1y * a2y; c11 += a2x * a2x + a2y * a2y;
    const tx = X[a + i] - (p0x * (b0 + b1) + p3x * (b2 + b3)), ty = Y[a + i] - (p0y * (b0 + b1) + p3y * (b2 + b3));
    x0 += a1x * tx + a1y * ty; x1 += a2x * tx + a2y * ty;
  }
  const det = c00 * c11 - c01 * c01; let al = 0, ar = 0;
  if (Math.abs(det) > 1e-12) { al = (x0 * c11 - x1 * c01) / det; ar = (c00 * x1 - c01 * x0) / det; }
  const seg = Math.hypot(p3x - p0x, p3y - p0y), eps = 1e-6 * seg;
  if (al < eps || ar < eps) { al = ar = seg / 3; }
  return [p0x, p0y, p0x + t1[0] * al, p0y + t1[1] * al, p3x + t2[0] * ar, p3y + t2[1] * ar, p3x, p3y];
}
function maxErr(X, Y, a, b, p, u) {
  let m = 0, s = Math.floor((b - a + 1) / 2) + a;
  for (let i = 1; i < b - a; i++) { const q = bez(p, u[i]), d = (q[0] - X[a + i]) ** 2 + (q[1] - Y[a + i]) ** 2; if (d >= m) { m = d; s = a + i; } }
  return [m, s];
}
function reparam(X, Y, a, b, u, p) {
  const n = b - a + 1, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = u[i], m = 1 - t, q = bez(p, t);
    const d1x = 3 * (m * m * (p[2] - p[0]) + 2 * m * t * (p[4] - p[2]) + t * t * (p[6] - p[4])), d1y = 3 * (m * m * (p[3] - p[1]) + 2 * m * t * (p[5] - p[3]) + t * t * (p[7] - p[5]));
    const d2x = 6 * (m * (p[4] - 2 * p[2] + p[0]) + t * (p[6] - 2 * p[4] + p[2])), d2y = 6 * (m * (p[5] - 2 * p[3] + p[1]) + t * (p[7] - 2 * p[5] + p[3]));
    const ex = q[0] - X[a + i], ey = q[1] - Y[a + i], den = d1x * d1x + d1y * d1y + ex * d2x + ey * d2y;
    out[i] = Math.abs(den) < 1e-9 ? t : Math.max(0, Math.min(1, t - (ex * d1x + ey * d1y) / den));
  }
  return out;
}

/**
 * Fit one chain. prm: { smooth (Taubin pairs), eps (DP tol), fitErr, cornerDeg, angular (bool) }.
 * Endpoints of open chains are never moved, so neighbouring regions stay glued.
 */
export function fitChain(xy, closed, prm) {
  let n = xy.length / 2; if (closed) n--;
  const x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = xy[i * 2]; y[i] = xy[i * 2 + 1]; }
  if (n < 2) return linePath([x[0] ?? 0, y[0] ?? 0], [x[0] ?? 0, y[0] ?? 0]);
  taubin(x, y, closed, Math.min(prm.smooth, Math.floor(n / 5)));
  const keep = new Uint8Array(n); keep[0] = 1; keep[n - 1] = 1;
  let startAt = 0;
  if (closed) {
    let far = 0, fd = -1; for (let i = 1; i < n; i++) { const d = (x[i] - x[0]) ** 2 + (y[i] - y[0]) ** 2; if (d > fd) { fd = d; far = i; } }
    keep[far] = 1; dp(x, y, 0, far, prm.eps, keep);
    // second half wraps: use a temp copy
    const x2 = new Float64Array(n - far + 1), y2 = new Float64Array(n - far + 1), k2 = new Uint8Array(n - far + 1);
    for (let i = far; i < n; i++) { x2[i - far] = x[i]; y2[i - far] = y[i]; } x2[n - far] = x[0]; y2[n - far] = y[0]; k2[0] = k2[n - far] = 1;
    dp(x2, y2, 0, n - far, prm.eps, k2);
    for (let i = far; i < n; i++) if (k2[i - far]) keep[i] = 1;
  } else dp(x, y, 0, n - 1, prm.eps, keep);
  const V = []; for (let i = 0; i < n; i++) if (keep[i]) V.push(i);
  if (prm.angular) {
    const pts = V.map((i) => [x[i], y[i]]); if (closed) pts.push([x[0], y[0]]);
    return polyPath(pts);
  }
  // corners
  const r = Math.max(3, Math.min(8, Math.round(prm.eps * 3))), cosT = Math.cos((prm.cornerDeg * Math.PI) / 180);
  const at = (i) => (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  const breaks = [];
  for (const i of V) {
    if (!closed && (i === 0 || i === n - 1)) { breaks.push(i); continue; }
    const a = at(i - r), b = at(i + r);
    const ax = x[i] - x[a], ay = y[i] - y[a], bx = x[b] - x[i], by = y[b] - y[i], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la > 0 && lb > 0 && (ax * bx + ay * by) / (la * lb) < cosT) breaks.push(i);
  }
  let forced = false; if (closed && !breaks.length) { breaks.push(0); forced = true; }
  const segs = [];
  const seg = (i, j, smoothStart, smoothEnd) => {
    const cnt = closed ? (j === i ? n + 1 : (((j - i) % n) + n) % n + 1) : j - i + 1; if (cnt < 2) return;
    const X = new Float64Array(cnt), Y = new Float64Array(cnt);
    for (let k = 0; k < cnt; k++) { const q = closed ? (i + k) % n : i + k; X[k] = x[q]; Y[k] = y[q]; }
    const m = Math.min(4, cnt - 1);
    let t1 = norm(X[m] - X[0], Y[m] - Y[0]), t2 = norm(X[cnt - 1 - m] - X[cnt - 1], Y[cnt - 1 - m] - Y[cnt - 1]);
    if (smoothStart) t1 = norm(x[at(i + 1)] - x[at(i - 1)], y[at(i + 1)] - y[at(i - 1)]);
    if (smoothEnd) { const c = norm(x[at(j + 1)] - x[at(j - 1)], y[at(j + 1)] - y[at(j - 1)]); t2 = [-c[0], -c[1]]; }
    const out = []; fitCubic(X, Y, 0, cnt - 1, t1, t2, prm.fitErr * prm.fitErr, out);
    for (const c of out) segs.push(c);
  };
  if (closed) {
    if (breaks.length === 1) seg(breaks[0], breaks[0], forced, forced);
    else for (let k = 0; k < breaks.length; k++) seg(breaks[k], breaks[(k + 1) % breaks.length], false, false);
  } else for (let k = 0; k + 1 < breaks.length; k++) seg(breaks[k], breaks[k + 1], false, false);
  return cubicsToPath(segs, [x[0], y[0]]);
}
function linePath(a, b) { return { cmds: Uint8Array.of(1), pts: Float32Array.of(a[0], a[1], b[0], b[1]) }; }
function polyPath(pts) {
  const cmds = new Uint8Array(Math.max(0, pts.length - 1)).fill(1), out = new Float32Array(2 + cmds.length * 2);
  out[0] = pts[0][0]; out[1] = pts[0][1]; for (let i = 1; i < pts.length; i++) { out[2 * i] = pts[i][0]; out[2 * i + 1] = pts[i][1]; }
  return { cmds, pts: out };
}
function cubicsToPath(segs, start) {
  const cmds = [], pts = [segs.length ? segs[0][0] : start[0], segs.length ? segs[0][1] : start[1]];
  for (const c of segs) {
    const dx = c[6] - c[0], dy = c[7] - c[1], L = Math.hypot(dx, dy) || 1e-9;
    const d1 = Math.abs((c[2] - c[0]) * dy - (c[3] - c[1]) * dx) / L, d2 = Math.abs((c[4] - c[0]) * dy - (c[5] - c[1]) * dx) / L;
    if (d1 < 0.04 && d2 < 0.04) { cmds.push(1); pts.push(c[6], c[7]); } else { cmds.push(3); pts.push(c[2], c[3], c[4], c[5], c[6], c[7]); }
  }
  return { cmds: Uint8Array.from(cmds), pts: Float32Array.from(pts) };
}

/** Pin the exact endpoints of a path (guards against float drift so shared joins stay identical). */
export function pinEnds(path, x0, y0, x1, y1) {
  const p = path.pts; p[0] = x0; p[1] = y0; p[p.length - 2] = x1; p[p.length - 1] = y1; return path;
}
export function reversePath(path) {
  const { cmds, pts } = path, n = cmds.length;
  const segStart = new Int32Array(n + 1); let o = 2;
  for (let i = 0; i < n; i++) { segStart[i] = o; o += cmds[i] === 3 ? 6 : 2; }
  const rc = new Uint8Array(n), rp = new Float32Array(pts.length);
  rp[0] = pts[pts.length - 2]; rp[1] = pts[pts.length - 1]; let w = 2;
  for (let i = n - 1; i >= 0; i--) {
    const s = segStart[i]; rc[n - 1 - i] = cmds[i];
    const px = i === 0 ? pts[0] : pts[segStart[i - 1] + (cmds[i - 1] === 3 ? 4 : 0)], py = i === 0 ? pts[1] : pts[segStart[i - 1] + (cmds[i - 1] === 3 ? 5 : 1)];
    if (cmds[i] === 3) { rp[w++] = pts[s + 2]; rp[w++] = pts[s + 3]; rp[w++] = pts[s]; rp[w++] = pts[s + 1]; rp[w++] = px; rp[w++] = py; }
    else { rp[w++] = px; rp[w++] = py; }
  }
  return { cmds: rc, pts: rp };
}
