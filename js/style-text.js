// style-text.js - typed text -> vector outline layers (TrueType glyph outlines, nonzero fill, optional offset shadow).
import { parseTTF, contourToPath } from './font-ttf.js';
import { fxActive, textFxLayers } from './text-fx.js';
import { TEXT_SLOTS, slotView, rotOff } from './config.js';

export const FONT_LANGS = ['en', 'ja'];
export const DEFAULT_FONT = { en: 'anton', ja: 'notosans' };
/** Font categories per language (the select shows them as option groups). */
export const FONT_CATS = { en: ['display', 'hand', 'type'], ja: ['mincho', 'gothic', 'round', 'jhand', 'pop'] };
const EN_FONTS = [
  { id: 'anton', file: 'Anton-Regular.ttf', name: 'Anton', cat: 'display' }, { id: 'bebas', file: 'BebasNeue-Regular.ttf', name: 'Bebas Neue', cat: 'display' },
  { id: 'archivo', file: 'ArchivoBlack-Regular.ttf', name: 'Archivo Black', cat: 'display' }, { id: 'abril', file: 'AbrilFatface-Regular.ttf', name: 'Abril Fatface', cat: 'display' },
  { id: 'shrikhand', file: 'Shrikhand-Regular.ttf', name: 'Shrikhand', cat: 'display' }, { id: 'bungee', file: 'Bungee-Regular.ttf', name: 'Bungee', cat: 'display' },
  { id: 'pacifico', file: 'Pacifico-Regular.ttf', name: 'Pacifico', cat: 'display' },
  { id: 'marker', file: 'PermanentMarker-Regular.ttf', name: 'Permanent Marker', cat: 'hand' }, { id: 'rocksalt', file: 'RockSalt-Regular.ttf', name: 'Rock Salt', cat: 'hand' },
  { id: 'caveat', file: 'Caveat-Variable.ttf', name: 'Caveat', cat: 'hand' }, { id: 'reenie', file: 'ReenieBeanie.ttf', name: 'Reenie Beanie', cat: 'hand' },
  { id: 'covered', file: 'CoveredByYourGrace.ttf', name: 'Covered By Your Grace', cat: 'hand' }, { id: 'homemade', file: 'HomemadeApple-Regular.ttf', name: 'Homemade Apple', cat: 'hand' },
  { id: 'gochi', file: 'GochiHand-Regular.ttf', name: 'Gochi Hand', cat: 'hand' }, { id: 'shadows', file: 'ShadowsIntoLight.ttf', name: 'Shadows Into Light', cat: 'hand' },
  { id: 'indie', file: 'IndieFlower-Regular.ttf', name: 'Indie Flower', cat: 'hand' }, { id: 'nothing', file: 'NothingYouCouldDo.ttf', name: 'Nothing You Could Do', cat: 'hand' },
  { id: 'sedgwick', file: 'SedgwickAve-Regular.ttf', name: 'Sedgwick Ave', cat: 'hand' },
  { id: 'typewriter', file: 'SpecialElite-Regular.ttf', name: 'Special Elite', cat: 'type' }, { id: 'courier', file: 'CourierPrime-Regular.ttf', name: 'Courier Prime', cat: 'type' },
  { id: 'courierb', file: 'CourierPrime-Bold.ttf', name: 'Courier Prime Bold', cat: 'type' }, { id: 'cutive', file: 'CutiveMono-Regular.ttf', name: 'Cutive Mono', cat: 'type' },
  { id: 'xanh', file: 'XanhMono-Regular.ttf', name: 'Xanh Mono', cat: 'type' }, { id: 'syne', file: 'SyneMono-Regular.ttf', name: 'Syne Mono', cat: 'type' },
].map((f) => ({ ...f, lang: 'en' }));
// Japanese fonts (subsets: JIS X 0208 kanji + kana + ASCII + common symbols; one weight each). Names are shown as-is in both UI languages.
const JA_FONTS = [
  { id: 'notoserif', file: 'NotoSerifJP.ttf', name: 'Noto Serif JP', cat: 'mincho' }, { id: 'shippori', file: 'ShipporiMincho-Bold.ttf', name: 'しっぽり明朝', cat: 'mincho' }, { id: 'zenold', file: 'ZenOldMincho-Regular.ttf', name: 'Zen Old Mincho', cat: 'mincho' }, { id: 'zenantique', file: 'ZenAntique-Regular.ttf', name: 'Zen Antique', cat: 'mincho' },
  { id: 'notosans', file: 'NotoSansJP.ttf', name: 'Noto Sans JP', cat: 'gothic' }, { id: 'zenkaku', file: 'ZenKakuGothicNew-Bold.ttf', name: 'Zen角ゴシック New', cat: 'gothic' },
  { id: 'mplusr', file: 'MPLUSRounded1c-Bold.ttf', name: 'M PLUS Rounded 1c', cat: 'round' }, { id: 'zenmaru', file: 'ZenMaruGothic-Bold.ttf', name: 'Zen丸ゴシック', cat: 'round' }, { id: 'kiwi', file: 'KiwiMaru-Regular.ttf', name: 'キウイ丸', cat: 'round' },
  { id: 'yomogi', file: 'Yomogi-Regular.ttf', name: 'よもぎ', cat: 'jhand' }, { id: 'klee', file: 'KleeOne-Regular.ttf', name: 'クレー One（教科書風）', cat: 'jhand' }, { id: 'kurenaido', file: 'ZenKurenaido-Regular.ttf', name: 'Zen紅道', cat: 'jhand' }, { id: 'yusei', file: 'YuseiMagic-Regular.ttf', name: 'ユウセイマジック（マジック書き）', cat: 'jhand' }, { id: 'hachimaru', file: 'HachiMaruPop-Regular.ttf', name: 'はちまるポップ', cat: 'jhand' },
  { id: 'dela', file: 'DelaGothicOne-Regular.ttf', name: 'デラゴシック（極太）', cat: 'pop' }, { id: 'reggae', file: 'ReggaeOne-Regular.ttf', name: 'レゲエ One', cat: 'pop' }, { id: 'rocknroll', file: 'RocknRollOne-Regular.ttf', name: 'ロックンロール One', cat: 'pop' }, { id: 'dotgothic', file: 'DotGothic16-Regular.ttf', name: 'ドットゴシック16', cat: 'pop' }, { id: 'potta', file: 'PottaOne-Regular.ttf', name: 'ポッタ One（筆ポップ）', cat: 'pop' },
].map((f) => ({ ...f, lang: 'ja' }));
export const FONTS = [...EN_FONTS, ...JA_FONTS];
export const fontsOf = (lang) => FONTS.filter((f) => f.lang === (lang === 'ja' ? 'ja' : 'en'));
/** The font a slot really uses: its chosen font when that belongs to the slot's language, else the language default. */
export const slotFontId = (q) => { const lang = q.textLang === 'ja' ? 'ja' : 'en', d = FONTS.find((f) => f.id === q.textFont); return d && d.lang === lang ? d.id : DEFAULT_FONT[lang]; };
const cache = new Map(), failed = new Set(), pending = new Map();
/** Japanese fonts: vertical centre of the ideographic em box (measured on 国) and a roomier line height, so kanji / kana sit centred on the text position. */
function markCjk(f, def) {
  if (!def || def.lang !== 'ja') return;
  let lo = Infinity, hi = -Infinity; for (const c of f.outline(f.glyphIndex(0x56fd))) for (const q of c) { if (q.y < lo) lo = q.y; if (q.y > hi) hi = q.y; }
  f.cjk = true; f.cjkMid = isFinite(lo) ? (lo + hi) / 2 / f.unitsPerEm : 0.38;
}
/** Loads + parses a bundled font (same-origin fetch). Resolves the parsed font or null on failure (the id is then remembered in `failed`). */
export function ensureFont(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  const def = FONTS.find((f) => f.id === id); if (!def) return Promise.resolve(null);
  if (pending.has(id)) return pending.get(id); // one fetch per font, however many callers wait for it
  const job = (async () => {
    try { const r = await fetch(new URL('../fonts/' + def.file, import.meta.url)); if (!r.ok) throw new Error(String(r.status)); const f = parseTTF(new Uint8Array(await r.arrayBuffer())); markCjk(f, def); cache.set(id, f); failed.delete(id); return f; }
    catch (e) { console.warn('font load failed', id, e); failed.add(id); return null; }
    finally { pending.delete(id); }
  })();
  pending.set(id, job); return job;
}
export const registerFont = (id, font) => { markCjk(font, FONTS.find((f) => f.id === id)); cache.set(id, font); }; // tests / preloaded
export const hasFont = (id) => cache.has(id);
export const fontFailed = (id) => failed.has(id);
/** Font ids that visible text slots need but that are neither loaded nor known to have failed (a slot whose font is missing draws nothing). */
export function missingFonts(p) {
  const ids = new Set(); for (let i = 0; i < TEXT_SLOTS; i++) { const q = slotView(p, i); if (q.text && q.text.trim() && q.textShow !== false && !cache.has(slotFontId(q)) && !failed.has(slotFontId(q))) ids.add(slotFontId(q)); }
  return [...ids];
}
/** Font ids of text slots that are shown but could not be loaded (for a visible error message). */
export function failedFonts(p) {
  const ids = new Set(); for (let i = 0; i < TEXT_SLOTS; i++) { const q = slotView(p, i); if (q.text && q.text.trim() && q.textShow && failed.has(slotFontId(q))) ids.add(slotFontId(q)); }
  return [...ids];
}
export const isLatinOnly = (s) => !/[^\u0000-ɏ‐-‧‰-›€]/.test(s);

/** Line height (in em): Japanese fonts get a little more room than the Latin default. */
export const lineHeightOf = (font) => (font && font.cjk ? 1.18 : 1.05);
/** Baseline offset from the top of a line box. Latin: as before (ascent based). Japanese: centres the kanji em box in the line. */
const baselineOf = (font, em, lh) => (font.cjk ? em * (lh / 2 + font.cjkMid) : em * (font.ascent / font.unitsPerEm) * 0.95);
/** Lays out text and returns a mini geometry {w,h,R,chains,loops} (one region per glyph) or null. */
export function layoutText(font, text, { w, h, size = 20, x = 50, y = 50, angle = 0, spacing = 0, lineHeight }) {
  if (lineHeight == null) lineHeight = lineHeightOf(font);
  const lines = String(text || '').split('\n').filter((l, i, a) => l.length || i < a.length - 1).slice(0, 6);
  if (!font || !lines.some((l) => l.trim())) return null;
  const em = (size / 100) * h, s = em / font.unitsPerEm, ax = (x / 100) * w, ay = (y / 100) * h, sp = (spacing / 100) * em;
  const widths = lines.map((ln) => { let wd = 0; for (const ch of ln) wd += font.advance(font.glyphIndex(ch.codePointAt(0))) * s + sp; return wd - sp; });
  const maxW = Math.max(...widths), blockH = em * lineHeight * lines.length, a = (angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const chains = [], loops = [];
  lines.forEach((ln, li) => {
    let pen = ax - widths[li] / 2; const base = ay - blockH / 2 + em * lineHeight * li + baselineOf(font, em, lineHeight);
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

/** Scene layers of one text slot (shadow first). Returns [] when the slot is hidden/empty or its font is not loaded yet. */
export function slotLayers(q, w, h, fxLong) {
  if (!q.text || !q.text.trim() || q.textShow === false) return [];
  const font = cache.get(slotFontId(q)); if (!font) return [];
  const geom = layoutText(font, q.text, { w, h, size: q.textSize, x: q.textX, y: q.textY, angle: q.textAngle, spacing: q.textSpacing });
  if (!geom) return [];
  if (fxActive(q)) return textFxLayers(geom, q, w, h, fxLong || 1000);
  const ids = Array.from({ length: geom.R }, (_, i) => i), out = [], off = (q.textShadow / 100) * 0.05 * h;
  if (q.textShadow > 0) out.push({ kind: 'fills', name: 'text-shadow', geom, rule: 'nonzero', offset: rotOff(off, off, q.lightDir), items: [{ fill: q.textShadowColor, regions: ids }] });
  out.push({ kind: 'fills', name: 'text', geom, rule: 'nonzero', offset: [0, 0], items: [{ fill: q.textColor, regions: ids }] });
  return out;
}
/** Scene layers for all text slots (slot 1 keeps the names text / text-shadow; slots 2, 3 use text2 / text3). */
export function textLayers(p, w, h) {
  const out = [];
  for (let i = 0; i < TEXT_SLOTS; i++) for (const L of slotLayers(slotView(p, i), w, h, p.fxLong)) { if (i) L.name = L.name.replace('text', 'text' + (i + 1)); out.push(L); }
  return out;
}
/** Box of a text slot in scene units: {cx,cy,w,h,angle(deg)} or null (used for the drag / rotate / scale handles). */
export function textBox(p, i, w, h) {
  const q = slotView(p, i); if (!q.text || !q.text.trim()) return null; const font = cache.get(slotFontId(q)); if (!font) return null;
  const lines = String(q.text).split('\n').slice(0, 6), em = (q.textSize / 100) * h, sc = em / font.unitsPerEm, sp = (q.textSpacing / 100) * em;
  let maxW = 0; for (const ln of lines) { let wd = 0; for (const ch of ln) wd += font.advance(font.glyphIndex(ch.codePointAt(0))) * sc + sp; maxW = Math.max(maxW, wd - sp); }
  return { cx: (q.textX / 100) * w, cy: (q.textY / 100) * h, w: Math.max(em * 0.5, maxW), h: em * lineHeightOf(font) * lines.length, angle: q.textAngle };
}
/** Loads the fonts of every text slot that has text. */
export async function ensureFonts(p) {
  const ids = new Set(); for (let i = 0; i < TEXT_SLOTS; i++) { const q = slotView(p, i); if (q.text && q.text.trim()) ids.add(slotFontId(q)); }
  await Promise.all([...ids].map((id) => ensureFont(id)));
}
