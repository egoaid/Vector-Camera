// style-random.js - seeded randomiser: palette, texture, halftone, background treatment, line overlay and the manual
// foreground/background assignment. Pure functions (no DOM) so they are unit-testable; the app applies the result.
import { mulberry32, hslToHex } from './color-utils.js';
import { PRESETS } from './style-palette.js';
import { randomPreset } from './style-colors.js';
import { fontsOf } from './style-text.js';
import { TEXT_SLOTS, tkey } from './config.js';
import { HT_TYPES } from './halftone-types.js';
import { LAYOUTS, ASPECTS, EDGES } from './style-collage.js';
import { tendencyPatch } from './style-tendency.js';
import { sampleLook } from './style-space.js';
import { applyMacro, parseMatrix } from './style-macro.js';
import { lockedKeys } from './style-presets.js';

const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => Math.round(a + r() * (b - a));
const clampL = (v) => Math.max(0, Math.min(100, v));

export { randomPreset };
/** Picks `n` random pixel positions (area-weighted via region labels) and gives each a different group than it has now. */
export function randomOverrides(r, res, groups, n) {
  const out = [], { w, h, labels } = res;
  for (let k = 0; k < n; k++) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h), cur = groups[labels[y * w + x]];
    out.push({ x, y, g: pick(r, [0, 1, 2].filter((g) => g !== cur)) });
  }
  return out;
}
/**
 * opts: the ticked targets (mode, palette, shape, tone, halftone, texture, background, subject, lines, collage, aspect, textOn, font, textFx) and optionally
 * `tendency` (see style-tendency.js; off / missing = the whole parameter space is open). Returns { params: {...patch}, overrides: [...]|null }.
 * `res`/`groups` are only needed for the foreground/background part.
 */
export function randomize(seed, opts, cur, res = null, groups = null, ctx = {}) {
  const r = mulberry32(seed >>> 0), patch = {};
  const tend = opts.tendency && opts.tendency !== 'off' ? opts.tendency : null;
  const rf = mulberry32(((seed >>> 0) ^ 0x9e3779b9) >>> 0); // own stream for the paper margin: other draws stay exactly as they were for a given seed
  Object.assign(patch, tend ? tendencyPatch(tend, r, opts, cur, rf) : sampleLook(r, cur, opts, {}, rf)); // every look parameter, structure first (style-space.js)
  let link = null; if (opts.link) link = applyMacro(patch, cur, seed, { depth: cur.linkDepth, cross: cur.linkCross, matrix: parseMatrix(cur.linkMatrix) }); // linked mode (opt-in): roughness / fineness / boldness axes pull related parameters together
  const pal0 = () => { const nx = { ...cur, ...patch }; return (nx.preset === 'random' && nx.customPreset ? nx.customPreset : PRESETS[nx.preset]) || PRESETS.pop; };
  // text: only when the "text" option is ticked (default off). Hidden slots / empty slots are never touched or switched on;
  // the wording itself is always yours. Every slot gets its own font, size, position, tilt, colours and print effects.
  if (opts.textOn) {
    const pal = pal0(), lanes = [[70, 90], [10, 30], [38, 62]];
    for (let i = 0; i < TEXT_SLOTS; i++) {
      const K = (k) => tkey(k, i); if (!cur[K('textShow')] || !String(cur[K('text')] || '').trim()) continue; // only slots that are shown right now; visibility is never changed
      if (opts.font) { // the font stays within the slot's language
        Object.assign(patch, { [K('textFont')]: pick(r, fontsOf(cur[K('textLang')])).id, [K('textColor')]: pick(r, pal.groups ? [pal.paper, pal.groups.fg.block[0], pal.groups.mid.block[0], pal.groups.bg.block[0]] : [pal.paper, pal.ink, pal.paper, pal.ink]), [K('textShadowColor')]: pal.ink,
          [K('textShadow')]: pick(r, [0, 15, 25, 40]), [K('textSpacing')]: range(r, 0, 8), [K('textSize')]: range(r, i ? 7 : 11, i ? 16 : 24),
          [K('textAngle')]: pick(r, [0, 0, 0, range(r, -15, 15), range(r, -90, 90)]), [K('textX')]: range(r, 30, 70), [K('textY')]: range(r, lanes[i][0], lanes[i][1]) });
      }
      if (opts.textFx) {
        const ht = r() < 0.4; Object.assign(patch, { [K('textHalftone')]: ht ? range(r, 35, 100) : 0 });
        if (ht) Object.assign(patch, { [K('textHalftoneType')]: pick(r, HT_TYPES), [K('textHalftoneSize')]: range(r, 3, 9), [K('textHalftoneAngle')]: pick(r, [15, 45, 75]), [K('textHalftoneMode')]: pick(r, ['down', 'up', 'right', 'flat']) });
        Object.assign(patch, { [K('textWear')]: r() < 0.5 ? range(r, 15, 70) : 0, [K('textDirt')]: r() < 0.4 ? range(r, 15, 70) : 0, [K('textSeed')]: range(r, 1, 99999) });
      }
    }
  }
  if (opts.aspect && ctx.collage) patch.collageAspect = pick(r, Object.keys(ASPECTS));
  if (opts.collage && ctx.collage) {
    const pal = pal0();
    Object.assign(patch, { collageLayout: pick(r, LAYOUTS), collageEdge: pick(r, ['organic', 'organic', 'organic', 'rough', 'cut']), collageSlots: r() < 0.5 ? 0 : range(r, 3, 10), collageTorn: range(r, 25, 95), collageGap: range(r, 0, 70), collageRotate: range(r, 10, 85), collageVary: r() < 0.5, collageSeed: range(r, 1, 99999), collagePaper: r() < 0.6 ? pal.paper : hslToHex(r() * 360, range(r, 20, 60), range(r, 82, 95)) });
  }
  let overrides = null;
  if (opts.subject && res && groups && ['silhouette', 'hybrid'].includes(patch.mode ?? cur.mode)) overrides = r() < 0.3 ? [] : randomOverrides(r, res, groups, range(r, 1, 4));
  for (const k of lockedKeys(cur)) delete patch[k]; // colours locked on the colour tab stay as they are
  return { params: patch, overrides, link };
}
/** Undo history of {params, overrides} snapshots. */
export class History {
  constructor(max = 30) { this.max = max; this.stack = []; }
  push(snap) { this.stack.push(JSON.parse(JSON.stringify(snap))); if (this.stack.length > this.max) this.stack.shift(); }
  pop() { return this.stack.pop() || null; }
  clear() { this.stack.length = 0; }
  get size() { return this.stack.length; }
}
