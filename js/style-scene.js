// style-scene.js - turns pipeline output + style params into a renderer-neutral "scene" (layer list).
// SVG, Canvas and PDF renderers all consume this same structure, so every output matches.
import { PRESETS, GROUP_KEYS, mapRegionsToPalette, allPresetColors } from './style-palette.js';
import { rgbToHex, hexToRgb } from './color-utils.js';

const hexOf = (st, r) => rgbToHex(st.rgb[r * 3], st.rgb[r * 3 + 1], st.rgb[r * 3 + 2]);
function groupBy(map) { const m = new Map(); for (const [r, fill] of map) { if (!m.has(fill)) m.set(fill, []); m.get(fill).push(r); } return [...m].map(([fill, regions]) => ({ fill, regions })); }

/**
 * res: pipeline result, groups: Uint8Array(R) (0 bg,1 mid,2 fg), p: UI params,
 * inkFactory(spec) -> bitmap | null (hybrid raster layers; omitted when null).
 */
export function buildScene(res, groups, p, inkFactory = null) {
  const { w, h, R, stats: st } = res, long = Math.max(w, h), sc = long / 640;
  const preset = PRESETS[p.preset] || PRESETS.natural;
  const scene = { w, h, paper: preset.paper, paperAmount: 0, layers: [], mode: p.mode, preset: preset.id };
  const all = Array.from({ length: R }, (_, i) => i);
  const seal = p.seal && !p.outline ? 0.7 : 0;
  const stroke = p.outline > 0 ? { w: (p.outline / 100) * 3 * sc, color: p.outlineColor } : null;
  let tw = 0, tr = 0, tg = 0, tb = 0;
  for (let r = 0; r < R; r++) { tw += st.area[r]; tr += st.rgb[r * 3] * st.area[r]; tg += st.rgb[r * 3 + 1] * st.area[r]; tb += st.rgb[r * 3 + 2] * st.area[r]; }
  const meanHex = rgbToHex(tr / tw, tg / tw, tb / tw);

  if (p.mode === 'vector' || p.mode === 'regions') {
    scene.paper = meanHex;
    let map = new Map();
    if (p.mode === 'regions' && preset.groups) {
      const pal = [...new Set(allPresetColors(preset))];
      // map region colours to the preset palette consistently: same source colour -> same output colour
      const key = (r) => (res.palIdx ? 'p' + res.palIdx[r] : 'r' + r);
      const rep = new Map(); for (const r of all) { const k = key(r); if (!rep.has(k)) rep.set(k, []); rep.get(k).push(r); }
      const reps = [...rep.values()].map((l) => l[0]);
      const m = mapRegionsToPalette(reps, st, pal, p.paletteMap);
      for (const l of rep.values()) for (const r of l) map.set(r, m.get(l[0]));
    } else for (const r of all) map.set(r, hexOf(st, r));
    scene.layers.push({ kind: 'rect', fill: meanHex });
    scene.layers.push({ kind: 'fills', name: p.mode === 'vector' ? 'regions' : 'color-regions', offset: [0, 0], items: groupBy(map), seal, stroke });
    return scene;
  }

  if (p.mode === 'silhouette') {
    const cols = p.silColors, byG = [[], [], []]; for (const r of all) byG[groups[r]].push(r);
    const fill = (g) => {
      if (!p.silSample) return cols[GROUP_KEYS[g]];
      let s = 0, a = 0, b = 0, c = 0; for (const r of byG[g]) { s += st.area[r]; a += st.rgb[r * 3] * st.area[r]; b += st.rgb[r * 3 + 1] * st.area[r]; c += st.rgb[r * 3 + 2] * st.area[r]; }
      return s ? rgbToHex(a / s, b / s, c / s) : cols[GROUP_KEYS[g]];
    };
    const pg = preset.groups;
    scene.paper = pg ? pg.bg.block[0] : cols.bg;
    scene.layers.push({ kind: 'rect', fill: scene.paper });
    const items = [];
    const presetFill = (g) => (g === 2 ? preset.ink : pg[GROUP_KEYS[g]].block[0]);
    for (let g = 0; g < 3; g++) if (byG[g].length) items.push({ fill: p.silSample || !pg ? fill(g) : presetFill(g), regions: byG[g], group: GROUP_KEYS[g] });
    scene.layers.push({ kind: 'fills', name: 'silhouette', offset: [0, 0], items, seal, stroke });
    return scene;
  }

  // ---- hybrid: flat colour blocks (vector) + processed photo ink (raster) clipped by vector shapes ----
  const pg = preset.groups || PRESETS.pop.groups;
  scene.paperAmount = p.paper / 100; scene.paper = preset.paper;
  const byG = [[], [], []]; for (const r of all) byG[groups[r]].push(r);
  const map = new Map();
  GROUP_KEYS.forEach((gk, g) => { const m = mapRegionsToPalette(byG[g], st, pg[gk].block, 'luma'); for (const [r, c] of m) map.set(r, c); });
  const bgPaper = p.bgTreatment === 'paper';
  const blockItems = groupBy(new Map([...map].filter(([r]) => !(bgPaper && groups[r] === 0))));
  const off = (p.misreg / 100) * 0.012 * long;
  scene.layers.push({ kind: 'fills', name: 'color-blocks', offset: [off, off * 0.7], items: blockItems, seal, stroke: null });
  if (inkFactory) {
    const flatThr = 0.12 * (1 - p.retention / 100);
    const common = { levels: p.separation, retention: p.retention / 100, halftone: p.halftone > 0, halftoneSize: p.halftoneSize, halftoneAngle: p.halftoneAngle, grain: p.grain / 100, roughness: p.roughness / 100 };
    if (preset.mode === 'key') {
      const ids = all.filter((r) => (groups[r] === 0 ? p.bgTreatment === 'photo' : pg[GROUP_KEYS[groups[r]]].ink));
      if (ids.length) { const bmp = inkFactory({ ...common, mode: 'key', regions: ids, color: preset.ink }); if (bmp) scene.layers.push({ kind: 'ink', name: 'key-plate', regions: ids, bitmap: bmp, blend: 'multiply' }); }
    } else {
      GROUP_KEYS.forEach((gk, g) => {
        if (g === 0 && p.bgTreatment !== 'photo') return;
        const ids = byG[g].filter((r) => st.texStd[r] >= flatThr);
        if (!ids.length) return;
        const bmp = inkFactory({ ...common, mode: 'bands', regions: ids, ramp: pg[gk].ramp, key: gk });
        if (bmp) scene.layers.push({ kind: 'ink', name: 'tone-' + gk, regions: ids, bitmap: bmp, blend: 'normal' });
      });
    }
  }
  return scene;
}
export const sceneHasRaster = (scene) => scene.layers.some((l) => l.kind === 'ink');
export const sceneStats = (scene) => ({ layers: scene.layers.length, raster: scene.layers.filter((l) => l.kind === 'ink').length });
