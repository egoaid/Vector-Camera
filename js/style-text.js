// style-text.js - typed text -> vector outline layers (TrueType glyph outlines, nonzero fill, optional offset shadow).
import { parseTTF, contourToPath } from './font-ttf.js';

export const FONTS = [
  { id: 'anton', file: 'Anton-Regular.ttf', name: 'Anton' }, { id: 'bebas', file: 'BebasNeue-Regular.ttf', name: 'Bebas Neue' },
  { id: 'archivo', file: 'ArchivoBlack-Regular.ttf', name: 'Archivo Black' }, { id: 'abril', file: 'AbrilFatface-Regular.ttf', name: 'Abril Fatface' },
  { id: 'shrikhand', file: 'Shrikhand-Regular.ttf', name: 'Shrikhand' }, { id: 'bungee', file: 'Bungee-Regular.ttf', name: 'Bungee' },
  { id: 'marker', file: 'PermanentMarker-Regular.ttf', name: 'Permanent Marker' }, { id: 'rocksalt', file: 'RockSalt-Regular.ttf', name: 'Rock Salt' },
  { id: 'typewriter', file: 'SpecialElite-Regular.ttf', name: 'Special Elite' }, { id: 'pacifico', file: 'Pacifico-Regular.ttf', name: 'Pacifico' },
];
const cache = new Map();
/** Loads + parses a bundled font (same-origin fetch). Resolves the parsed font or null on failure. */
export async function ensureFont(id) {
  if (cache.has(id)) return cache.get(id);
  const def = FONTS.find((f) => f.id === id); if (!def) return null;
  try { const r = await fetch(new URL('../fonts/' + def.file, import.meta.url)); if (!r.ok) throw new Error(String(r.status)); const f = parseTTF(new Uint8Array(await r.arrayBuffer())); cache.set(id, f); return f; }
  catch (e) { console.warn('font load failed', id, e); return null; }
}
export const registerFont = (id, font) => cache.set(id, font); // tests / preloaded
export const hasFont = (id) => cache.has(id);
export const isLatinOnly = (s) => !/[^\u0000-ɏ‐-‧‰-›€]/.test(s);

/** Lays out text and returns a mini geometry {w,h,R,chains,loops} (one region per glyph) or null. */
export function layoutText(font, text, { w, h, size = 20, x = 50, y = 50, angle = 0, spacing = 0, lineHeight = 1.05 }) {
  const lines = String(text || '').split('\n').filter((l, i, a) => l.length || i < a.length - 1).slice(0, 6);
  if (!font || !lines.some((l) => l.trim())) return null;
  const em = (size / 100) * h, s = em / font.unitsPerEm, ax = (x / 100) * w, ay = (y / 100) * h, sp = (spacing / 100) * em;
  const widths = lines.map((ln) => { let wd = 0; for (const ch of ln) wd += font.advance(font.glyphIndex(ch.codePointAt(0))) * s + sp; return wd - sp; });
  const maxW = Math.max(...widths), blockH = em * lineHeight * lines.length, a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const chains = [], loops = [];
  lines.forEach((ln, li) => {
    let pen = ax - widths[li] / 2; const base = ay - blockH / 2 + em * lineHeight * li + em * ((font.ascent) / font.unitsPerEm) * 0.95;
    for (const ch of ln) {
      const gid = font.glyphIndex(ch.codePointAt(0)), cons = font.outline(gid), mine = [];
      for (const c of cons) {
        const p = contourToPath(c, s, pen, base); if (!p) continue;
        for (let i = 0; i < p.pts.length; i += 2) { const dx = p.pts[i] - ax, dy = p.pts[i + 1] - ay; p.pts[i] = ax + dx * ca - dy * sa; p.pts[i + 1] = ay + dx * sa + dy * ca; }
        chains.push(p); mine.push(Int32Array.of((chains.length - 1) * 2 + 1)); // each contour is its own closed loop
      }
      if (mine.length) loops.push(mine); else loops.push([]);
      pen += font.advance(gid) * s + sp;
    }
  });
  // flatten: one region per glyph, loops[r] = list of single-chain loops
  return { w, h, R: loops.length, chains, loops, maxW };
}

/** Scene layers for the text overlay (shadow first). Returns [] when text is empty or the font is not loaded yet. */
export function textLayers(p, w, h) {
  if (!p.text || !p.text.trim()) return [];
  const font = cache.get(p.textFont); if (!font) return [];
  const geom = layoutText(font, p.text, { w, h, size: p.textSize, x: p.textX, y: p.textY, angle: p.textAngle, spacing: p.textSpacing });
  if (!geom) return [];
  const ids = Array.from({ length: geom.R }, (_, i) => i), out = [], off = (p.textShadow / 100) * 0.05 * h;
  if (p.textShadow > 0) out.push({ kind: 'fills', name: 'text-shadow', geom, rule: 'nonzero', offset: [off, off], items: [{ fill: p.textShadowColor, regions: ids }] });
  out.push({ kind: 'fills', name: 'text', geom, rule: 'nonzero', offset: [0, 0], items: [{ fill: p.textColor, regions: ids }] });
  return out;
}
