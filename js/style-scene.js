// style-scene.js - turns pipeline output + style params into a renderer-neutral "scene" (layer list).
// SVG, Canvas and PDF renderers all consume this same structure, so every output matches.
import { htOptsFrom } from './halftone-types.js';
import { rotOff } from './config.js';
import { PRESETS, GROUP_KEYS, mapRegionsToPalette, allPresetColors, getPreset } from './style-palette.js';
import { rgbToHex, hexToRgb, hueRotateHex } from './color-utils.js';
import { textLayers } from './style-text.js';
import { frameOn, wrapFrame } from './style-frame.js';
import { sgOptsFrom, ttOptsFrom, tonedRamp, neutralRamp } from './tone-photo.js';

const hexColor = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : null); // halftone / tone ink colour override ('' = follow the palette)
const hexOf = (st, r) => rgbToHex(st.rgb[r * 3], st.rgb[r * 3 + 1], st.rgb[r * 3 + 2]);
function groupBy(map) { const m = new Map(); for (const [r, fill] of map) { if (!m.has(fill)) m.set(fill, []); m.get(fill).push(r); } return [...m].map(([fill, regions]) => ({ fill, regions })); }

/**
 * res: pipeline result, groups: Uint8Array(R) (0 bg,1 mid,2 fg), p: UI params,
 * inkFactory(spec) -> bitmap | null (hybrid raster layers; omitted when null).
 */
export function buildScene(res, groups, p, inkFactory = null) {
  const base = buildBase(res, groups, p, inkFactory); addLines(base, res, groups, p); base.geom = res.geom;
  const scene = frameOn(p) ? wrapFrame(base, res, p) : base; // a paper margin around the picture; text then lives on the whole canvas (it may sit in the margin)
  for (const L of textLayers(p, scene.w, scene.h)) scene.layers.push(L);
  scene.geom = res.geom; return scene;
}

/** Overlays shared by every mode: contour lines (region boundaries, optional offset copy) and vector text. */
export function addLines(scene, res, groups, p) {
  const { w, h, R } = res, sc = Math.max(w, h) / 640;
  if (p.lineWidth > 0) {
    const ids = []; for (let r = 0; r < R; r++) if (p.lineScope === 'all' || (p.lineScope === 'fg' ? groups[r] === 2 : groups[r] >= 1)) ids.push(r);
    if (ids.length) {
      const lw = (p.lineWidth / 100) * 3 * sc, off = (p.lineOffset / 100) * 0.02 * Math.max(w, h);
      if (off > 0.2) scene.layers.push({ kind: 'fills', name: 'lines-offset', offset: rotOff(off, off * 0.7, p.lightDir), seal: 0, stroke: { w: lw, color: p.lineColor2 }, items: [{ fill: null, regions: ids }] });
      scene.layers.push({ kind: 'fills', name: 'lines', offset: [0, 0], seal: 0, stroke: { w: lw, color: p.lineColor }, items: [{ fill: null, regions: ids }] });
    }
  }
}
export function addOverlays(scene, res, groups, p) {
  addLines(scene, res, groups, p);
  for (const L of textLayers(p, scene.w, scene.h)) scene.layers.push(L);
  scene.geom = res.geom;
}

/**
 * Tone / halftone ink ON TOP of the vector colour fills (vector and regions modes). The ink layers multiply over the fills, so the colours stay visible
 * under the tonal drawing: silver = continuous tone (toned ramp), two-tone = one ink on the colours, classic + halftone = a halftone key plate.
 * Nothing is added with classic tone and halftone off, so a plain vector picture stays exactly as before.
 */
function addOverlayInk(scene, res, groups, p, preset, all, inkFactory) {
  const tone = p.tone === 'silver' || p.tone === 'twotone' ? p.tone : 'classic';
  if (tone === 'classic' && !(p.halftone > 0)) return;
  const htCol = hexColor(p.htColor), inkCol = htCol || preset.ink;
  const common = { levels: p.separation, retention: p.retention / 100, halftone: p.halftone > 0, halftoneType: p.halftoneType || 'dot', halftoneOpts: htOptsFrom(p), halftoneSize: p.halftoneSize, halftoneAngle: p.halftoneAngle, grain: p.grain / 100, roughness: p.roughness / 100, groupOf: groups, tone, htMix: p.htMix ?? 70, sg: sgOptsFrom(p), tt: ttOptsFrom(p) };
  if (tone === 'silver') {
    const tr = tonedRamp(neutralRamp(preset.ink, preset.paper), p.sgToning, p.sgToningAmt), ramp = htCol ? [htCol, ...tr.slice(1)] : tr, bmp = inkFactory({ ...common, mode: 'bands', regions: all, ramp, key: 'fg' });
    if (bmp) scene.layers.push({ kind: 'ink', name: 'tone-overlay', regions: all, bitmap: bmp, blend: 'multiply', spec: { mode: 'bands', ramp, levels: 8 } });
  } else {
    const bmp = inkFactory({ ...common, mode: 'key', regions: all, color: inkCol });
    if (bmp) scene.layers.push({ kind: 'ink', name: tone === 'twotone' ? 'key-plate' : 'halftone-overlay', regions: all, bitmap: bmp, blend: 'multiply', spec: { mode: 'key', color: inkCol } });
  }
}

export function buildBase(res, groups, p, inkFactory) {
  const { w, h, R, stats: st } = res, long = Math.max(w, h), sc = long / 640;
  const preset = getPreset(p);
  const scene = { w, h, paper: preset.paper, paperAmount: 0, layers: [], mode: p.mode, preset: preset.id };
  const all = Array.from({ length: R }, (_, i) => i);
  const seal = p.seal && !p.outline ? 0.7 : 0;
  const stroke = p.outline > 0 ? { w: (p.outline / 100) * 3 * sc, color: p.outlineColor } : null;
  let tw = 0, tr = 0, tg = 0, tb = 0;
  for (let r = 0; r < R; r++) { tw += st.area[r]; tr += st.rgb[r * 3] * st.area[r]; tg += st.rgb[r * 3 + 1] * st.area[r]; tb += st.rgb[r * 3 + 2] * st.area[r]; }
  const hs = +p.hueShift || 0, meanHex = hueRotateHex(rgbToHex(tr / tw, tg / tw, tb / tw), hs);

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
    } else for (const r of all) map.set(r, hueRotateHex(hexOf(st, r), hs));
    scene.layers.push({ kind: 'rect', fill: meanHex });
    scene.layers.push({ kind: 'fills', name: p.mode === 'vector' ? 'regions' : 'color-regions', offset: [0, 0], items: groupBy(map), seal, stroke });
    if (inkFactory) addOverlayInk(scene, res, groups, p, preset, all, inkFactory);
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
  const tone = p.tone === 'silver' || p.tone === 'twotone' ? p.tone : 'classic';
  scene.paperAmount = p.paper / 100; scene.paper = preset.paper;
  if (tone === 'twotone' && p.ttStrict !== false) scene.paperAmount = 0; // strict two-tone: only ink and paper, no paper grain
  const byG = [[], [], []]; for (const r of all) byG[groups[r]].push(r);
  const map = new Map();
  GROUP_KEYS.forEach((gk, g) => { const m = mapRegionsToPalette(byG[g], st, pg[gk].block, 'luma'); for (const [r, c] of m) map.set(r, c); });
  const bgPaper = p.bgTreatment === 'paper';
  const blockItems = groupBy(new Map([...map].filter(([r]) => !(bgPaper && groups[r] === 0))));
  const off = (p.misreg / 100) * 0.012 * long;
  if (tone !== 'twotone') scene.layers.push({ kind: 'fills', name: 'color-blocks', offset: rotOff(off, off * 0.7, p.lightDir), items: blockItems, seal, stroke: null }); // two-tone has no flat colour blocks: just ink on paper
  if (inkFactory) {
    const flatThr = 0.12 * (1 - p.retention / 100);
    const htCol = hexColor(p.htColor); // ink colour override: key plate ink / darkest tone of the bands (whatever the tone and halftone settings)
    const common = { levels: p.separation, retention: p.retention / 100, halftone: p.halftone > 0, halftoneType: p.halftoneType || 'dot', halftoneOpts: htOptsFrom(p), halftoneSize: p.halftoneSize, halftoneAngle: p.halftoneAngle, grain: p.grain / 100, roughness: p.roughness / 100, groupOf: groups, tone, htMix: p.htMix ?? 70, sg: sgOptsFrom(p), tt: ttOptsFrom(p) };
    if (tone === 'twotone') { // every region, whatever the palette's ink flags say: the whole photo becomes one key plate
      if (all.length) { const bmp = inkFactory({ ...common, mode: 'key', regions: all, color: htCol || preset.ink }); if (bmp) scene.layers.push({ kind: 'ink', name: 'key-plate', regions: all, bitmap: bmp, blend: 'multiply', spec: { mode: 'key', color: htCol || preset.ink } }); }
    } else if (preset.mode === 'key' && tone === 'classic') {
      const ids = all.filter((r) => (groups[r] === 0 ? p.bgTreatment === 'photo' : pg[GROUP_KEYS[groups[r]]].ink));
      if (ids.length) { const bmp = inkFactory({ ...common, mode: 'key', regions: ids, color: htCol || preset.ink }); if (bmp) scene.layers.push({ kind: 'ink', name: 'key-plate', regions: ids, bitmap: bmp, blend: 'multiply', spec: { mode: 'key', color: htCol || preset.ink } }); }
    } else {
      GROUP_KEYS.forEach((gk, g) => {
        if (g === 0 && p.bgTreatment !== 'photo') return;
        const ids = byG[g].filter((r) => tone === 'silver' || st.texStd[r] >= flatThr); // a silver-gelatin print has no flat (untextured) regions
        if (!ids.length) return;
        // silver-gelatin on a one-ink palette: a neutral ink -> paper ramp; toning (sepia / selenium) is mixed into the ramp so SVG / PDF vectorising sees the same colours
        let base = pg[gk].ramp || neutralRamp(preset.ink, preset.paper); if (tone === 'silver') base = tonedRamp(base, p.sgToning, p.sgToningAmt);
        const ramp = htCol ? [htCol, ...base.slice(1)] : base, bmp = inkFactory({ ...common, mode: 'bands', regions: ids, ramp, key: gk });
        if (bmp) scene.layers.push({ kind: 'ink', name: 'tone-' + gk, regions: ids, bitmap: bmp, blend: 'normal', spec: { mode: 'bands', ramp, levels: tone === 'silver' ? 8 : p.separation } }); // silver: 8 tone bands when traced to vector
      });
    }
  }
  return scene;
}
const anyInk = (layers) => layers.some((l) => l.kind === 'ink' || (l.layers && anyInk(l.layers)));
export const sceneHasRaster = (scene) => anyInk(scene.layers);
export const sceneStats = (scene) => ({ layers: scene.layers.length, raster: scene.layers.filter((l) => l.kind === 'ink').length });
