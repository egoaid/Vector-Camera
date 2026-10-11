// font-ttf.js - minimal TrueType (glyf) reader: cmap format 4, hmtx, simple + composite glyphs -> outline contours.
// Used only to turn text into vector outlines (no DOM, no dependencies; unit-testable in Node).
export function parseTTF(buf) {
  const dv = new DataView(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  const n = dv.getUint16(4), T = {};
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; T[tag(o)] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) }; }
  for (const k of ['head', 'maxp', 'hhea', 'hmtx', 'loca', 'glyf', 'cmap']) if (!T[k]) throw new Error('ttf: missing ' + k);
  const upm = dv.getUint16(T.head.off + 18), locFmt = dv.getInt16(T.head.off + 50), numGlyphs = dv.getUint16(T.maxp.off + 4);
  const ascent = dv.getInt16(T.hhea.off + 4), descent = dv.getInt16(T.hhea.off + 6), nHM = dv.getUint16(T.hhea.off + 34);
  const loca = (g) => (locFmt ? dv.getUint32(T.loca.off + g * 4) : dv.getUint16(T.loca.off + g * 2) * 2);
  // cmap: pick a Unicode BMP format-4 subtable
  let cm = null; const nt = dv.getUint16(T.cmap.off + 2);
  for (let i = 0; i < nt; i++) { const pid = dv.getUint16(T.cmap.off + 4 + i * 8), eid = dv.getUint16(T.cmap.off + 6 + i * 8), off = T.cmap.off + dv.getUint32(T.cmap.off + 8 + i * 8); if (dv.getUint16(off) === 4 && (pid === 0 || (pid === 3 && eid === 1))) { cm = off; break; } }
  if (cm == null) throw new Error('ttf: no format 4 cmap');
  const segX2 = dv.getUint16(cm + 6), endO = cm + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const glyphIndex = (cp) => {
    for (let s = 0; s < segX2; s += 2) {
      if (cp > dv.getUint16(endO + s)) continue; const st = dv.getUint16(startO + s); if (cp < st) return 0;
      const ro = dv.getUint16(rangeO + s), dl = dv.getInt16(deltaO + s); if (!ro) return (cp + dl) & 0xffff;
      const g = dv.getUint16(rangeO + s + ro + (cp - st) * 2); return g ? (g + dl) & 0xffff : 0;
    }
    return 0;
  };
  const advance = (g) => dv.getUint16(T.hmtx.off + Math.min(g, nHM - 1) * 4);
  const simple = (o, nc) => {
    const ends = []; for (let i = 0; i < nc; i++) ends.push(dv.getUint16(o + 10 + i * 2));
    const np = nc ? ends[nc - 1] + 1 : 0, il = dv.getUint16(o + 10 + nc * 2); let p = o + 12 + nc * 2 + il;
    const fl = []; while (fl.length < np) { const f = dv.getUint8(p++); fl.push(f); if (f & 8) { let r = dv.getUint8(p++); while (r--) fl.push(f); } }
    const xs = [], ys = []; let v = 0;
    for (let i = 0; i < np; i++) { const f = fl[i]; if (f & 2) { const d = dv.getUint8(p++); v += f & 16 ? d : -d; } else if (!(f & 16)) { v += dv.getInt16(p); p += 2; } xs.push(v); }
    v = 0; for (let i = 0; i < np; i++) { const f = fl[i]; if (f & 4) { const d = dv.getUint8(p++); v += f & 32 ? d : -d; } else if (!(f & 32)) { v += dv.getInt16(p); p += 2; } ys.push(v); }
    const out = []; let s = 0; for (const e of ends) { const c = []; for (let i = s; i <= e; i++) c.push({ x: xs[i], y: ys[i], on: !!(fl[i] & 1) }); out.push(c); s = e + 1; }
    return out;
  };
  const outline = (g, depth = 0) => {
    const a = loca(g), b = loca(g + 1); if (a === b || depth > 4) return [];
    const o = T.glyf.off + a, nc = dv.getInt16(o);
    if (nc >= 0) return simple(o, nc);
    const res = []; let p = o + 10, f;
    do {
      f = dv.getUint16(p); const gi = dv.getUint16(p + 2); p += 4; let dx, dy;
      if (f & 1) { dx = dv.getInt16(p); dy = dv.getInt16(p + 2); p += 4; } else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
      let a1 = 1, b1 = 0, c1 = 0, d1 = 1; const f2 = (q) => dv.getInt16(q) / 16384;
      if (f & 8) { a1 = d1 = f2(p); p += 2; } else if (f & 0x40) { a1 = f2(p); d1 = f2(p + 2); p += 4; } else if (f & 0x80) { a1 = f2(p); b1 = f2(p + 2); c1 = f2(p + 4); d1 = f2(p + 6); p += 8; }
      if (!(f & 2)) { dx = 0; dy = 0; }
      for (const c of outline(gi, depth + 1)) res.push(c.map((q) => ({ x: a1 * q.x + c1 * q.y + dx, y: b1 * q.x + d1 * q.y + dy, on: q.on })));
    } while (f & 0x20);
    return res;
  };
  return { unitsPerEm: upm, ascent, descent, numGlyphs, glyphIndex, advance, outline };
}

/** Contour (TrueType quadratic points) -> chain path {cmds, pts} in output units: x*s + ox, -y*s + oy (y flipped). */
export function contourToPath(c, s, ox, oy) {
  const n = c.length; if (n < 2) return null;
  const P = c.map((q) => ({ x: q.x * s + ox, y: -q.y * s + oy, on: q.on }));
  // start at an on-curve point (synthesise one when the contour is all off-curve)
  let pts = P; const firstOn = P.findIndex((q) => q.on);
  if (firstOn < 0) { const m = { x: (P[0].x + P[n - 1].x) / 2, y: (P[0].y + P[n - 1].y) / 2, on: true }; pts = [m, ...P]; }
  else pts = [...P.slice(firstOn), ...P.slice(0, firstOn)];
  pts.push({ ...pts[0] });
  const cmds = [], co = [pts[0].x, pts[0].y]; let cur = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i];
    if (q.on) { cmds.push(2); co.push(q.x, q.y); cur = q; continue; }
    let nx = pts[i + 1]; let end;
    if (nx.on) { end = nx; i++; } else end = { x: (q.x + nx.x) / 2, y: (q.y + nx.y) / 2 };
    cmds.push(3); co.push(cur.x + (2 / 3) * (q.x - cur.x), cur.y + (2 / 3) * (q.y - cur.y), end.x + (2 / 3) * (q.x - end.x), end.y + (2 / 3) * (q.y - end.y), end.x, end.y); cur = end;
  }
  return { cmds: Uint8Array.from(cmds), pts: Float64Array.from(co) };
}
