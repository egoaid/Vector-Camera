// vec-chains.js - traces region boundaries on the pixel-corner lattice into junction-to-junction chains.
// Every boundary between two regions becomes ONE chain with (left,right) labels, so adjacent regions
// reuse identical geometry (no cracks / slivers). Outside of the image frame has label -1.
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // E, S, W, N

export function traceBoundaries(labels, w, h) {
  const W1 = w + 1;
  const Lb = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : labels[y * w + x]);
  const hB = new Uint8Array((h + 1) * w), vB = new Uint8Array(h * W1), deg = new Uint8Array((h + 1) * W1);
  for (let y = 0; y <= h; y++) for (let x = 0; x < w; x++) if (Lb(x, y - 1) !== Lb(x, y)) { hB[y * w + x] = 1; deg[y * W1 + x]++; deg[y * W1 + x + 1]++; }
  for (let y = 0; y < h; y++) for (let x = 0; x <= w; x++) if (Lb(x - 1, y) !== Lb(x, y)) { vB[y * W1 + x] = 1; deg[y * W1 + x]++; deg[(y + 1) * W1 + x]++; }
  const corner = (x, y) => (x === 0 || x === w) && (y === 0 || y === h);
  const isStop = (x, y) => { const d = deg[y * W1 + x]; return d !== 2 || corner(x, y); };
  // edge accessors: flags bit0 = boundary, bit1 = visited
  const edgeRef = (x, y, d) => {
    if (d === 0) return x < w ? [hB, y * w + x] : null;
    if (d === 2) return x > 0 ? [hB, y * w + x - 1] : null;
    if (d === 1) return y < h ? [vB, y * W1 + x] : null;
    return y > 0 ? [vB, (y - 1) * W1 + x] : null;
  };
  const usable = (x, y, d) => { const r = edgeRef(x, y, d); return r && (r[0][r[1]] & 3) === 1; };
  const sideLabels = (x, y, d) => {
    if (d === 0) return [Lb(x, y - 1), Lb(x, y)];
    if (d === 2) return [Lb(x - 1, y), Lb(x - 1, y - 1)];
    if (d === 1) return [Lb(x, y), Lb(x - 1, y)];
    return [Lb(x - 1, y - 1), Lb(x, y - 1)];
  };
  const chains = [];
  const walk = (x0, y0, d0) => {
    const [left, right] = sideLabels(x0, y0, d0);
    const pts = [x0, y0]; let x = x0, y = y0, d = d0;
    for (;;) {
      const r = edgeRef(x, y, d); r[0][r[1]] |= 2;
      x += DX[d]; y += DY[d]; pts.push(x, y);
      if (isStop(x, y)) break;
      if (x === x0 && y === y0) break;
      let nd = -1;
      for (let k = 0; k < 4; k++) { if (k === (d + 2) % 4) continue; const rr = edgeRef(x, y, k); if (rr && (rr[0][rr[1]] & 1)) { nd = k; break; } }
      if (nd < 0) break;
      d = nd;
    }
    chains.push({ xy: Float64Array.from(pts), left, right, closed: x === x0 && y === y0, sv: y0 * W1 + x0, ev: y * W1 + x });
  };
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
    if (!isStop(x, y) || !deg[y * W1 + x]) continue;
    for (let d = 0; d < 4; d++) if (usable(x, y, d)) walk(x, y, d);
  }
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
    if (deg[y * W1 + x] !== 2) continue;
    for (let d = 0; d < 4; d++) if (usable(x, y, d)) walk(x, y, d);
  }
  return { chains, W1 };
}
