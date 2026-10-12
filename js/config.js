// config.js - defaults, limits, presets and slider -> pipeline parameter mapping.
export const MODES = ['vector', 'silhouette', 'regions', 'hybrid'];
export const LIMITS = {
  working: { low: 512, standard: 768, high: 1024 },   // long edge of the segmentation working copy
  sourceMax: 2400,                                     // long edge kept for hybrid raster / PNG export
  exportLong: [1024, 2048, 3072],
  liteLong: 1280, hybridRasterMax: 1600,                               // raster ink resolution embedded in SVG / PDF
  pdfLongPt: 841.89,
};
export const AI = {
  transformersVersion: '4.3.1',
  cdn: (v) => `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${v}`,
  model: 'Xenova/segformer-b0-finetuned-ade-512-512',
  dtype: 'q8',
  approxModelMB: 4.4,
};
export const DEFAULT_PARAMS = {
  mode: 'hybrid', preset: 'pop', quality: 'standard', engine: 'classic',
  detail: 45, boundary: 50, simplify: 35, angularity: 25, minRegion: 30, subjectSize: 30,
  paletteK: 8, paletteMap: 'luma',
  seal: true, outline: 0, outlineColor: '#111111', background: 'auto',
  silColors: { bg: '#f2d934', mid: '#e1456d', fg: '#17121c' }, silSample: false,
  separation: 3, retention: 45, halftone: 0, halftoneType: 'dot', htWeight: 50, htLayers: 3, htSpread: 60, htCurve: 40, htSketch: 40, htWave: 50, htWaveLen: 50, htGuilloche: 40, halftoneSize: 6, halftoneAngle: 45,
  grain: 25, roughness: 20, misreg: 25, paper: 25, bgTreatment: 'flat', semStrength: 100,
  exportLong: 2048, wakeLock: true,
  lineWidth: 0, lineColor: '#17121c', lineColor2: '#ff7a3a', lineOffset: 0, lineScope: 'mid',
  text: 'Vector Camera', textFont: 'anton', textSize: 16, textX: 50, textY: 78, textAngle: 0, textSpacing: 2, textColor: '#fff4f4', textShadow: 20, textShadowColor: '#17121c', textShow: false, textHalftone: 0, textHalftoneType: 'dot', textHalftoneSize: 5, textHalftoneAngle: 45, textHalftoneMode: 'down', textWear: 0, textDirt: 0, textSeed: 1,
  vecInk: false, vecInkLong: 1400, vecInkSpeck: 2,
  collageLayout: 'torn', collageAspect: '4:5', collageSlots: 0, collageTorn: 60, collageGap: 30, collageRotate: 40, collageVary: false, collageSeed: 1, collagePaper: '', collageEdge: 'organic',
  rndOpts: { palette: true, texture: true, background: true, subject: true, lines: true, font: true, textOn: false, textFx: true, collage: true, aspect: true },
  customPreset: null,
  // text slots 2 and 3 (keys get a _1 / _2 suffix); slot 1 uses the plain keys above
  text_1: '', textFont_1: 'marker', textSize_1: 11, textX_1: 50, textY_1: 22, textAngle_1: 0, textSpacing_1: 2, textColor_1: '#ffd23f', textShadow_1: 20, textShadowColor_1: '#17121c', textShow_1: false, textHalftone_1: 0, textHalftoneType_1: 'dot', textHalftoneSize_1: 5, textHalftoneAngle_1: 45, textHalftoneMode_1: 'down', textWear_1: 0, textDirt_1: 0, textSeed_1: 2,
  text_2: '', textFont_2: 'typewriter', textSize_2: 9, textX_2: 50, textY_2: 50, textAngle_2: 0, textSpacing_2: 2, textColor_2: '#ffffff', textShadow_2: 0, textShadowColor_2: '#17121c', textShow_2: false, textHalftone_2: 0, textHalftoneType_2: 'dot', textHalftoneSize_2: 5, textHalftoneAngle_2: 45, textHalftoneMode_2: 'down', textWear_2: 0, textDirt_2: 0, textSeed_2: 3,
};
export const TEXT_SLOTS = 3;
export const TEXT_BASE = ['text', 'textFont', 'textSize', 'textX', 'textY', 'textAngle', 'textSpacing', 'textColor', 'textShadow', 'textShadowColor', 'textShow', 'textHalftone', 'textHalftoneType', 'textHalftoneSize', 'textHalftoneAngle', 'textHalftoneMode', 'textWear', 'textDirt', 'textSeed'];
/** Parameter key of text slot `i` (0..2): slot 0 uses the plain key, others get _1 / _2. */
export const tkey = (k, i) => (i ? `${k}_${i}` : k);
/** A view of slot `i` with the plain key names (what style-text / text-fx read). */
export const slotView = (p, i) => { const o = {}; for (const k of TEXT_BASE) o[k] = p[tkey(k, i)]; for (const k of HT_KEYS) o[k] = p[k]; return o; };
export const HT_KEYS = ['htWeight', 'htLayers', 'htSpread', 'htCurve', 'htSketch', 'htWave', 'htWaveLen', 'htGuilloche'];
export const MODE_DEFAULTS = {
  vector: { detail: 62, paletteK: 0, simplify: 30, angularity: 20, outline: 0 },
  silhouette: { detail: 24, paletteK: 0, simplify: 45, angularity: 35, subjectSize: 30 },
  regions: { detail: 40, paletteK: 8, simplify: 40, angularity: 40, paletteMap: 'nearest' },
  hybrid: { detail: 42, paletteK: 0, simplify: 35, angularity: 25, separation: 3, retention: 45, grain: 25, misreg: 25 },
};
const STYLES = ['pop', 'sleeve', 'riso', 'duo', 'mono', 'unite', 'garden', 'lovepop', 'olive', 'earth', 'field', 'stripes', 'maroon', 'boombox', 'stadium', 'lavender', 'skygreen', 'bluepeach', 'kraft', 'palm', 'typewriter', 'sunhill', 'cyan', 'royal', 'tealpink'];
export const MODE_PRESETS = { vector: ['natural'], silhouette: STYLES, regions: ['natural', ...STYLES], hybrid: STYLES };

/** detail 0..100 -> target region count (6 .. 900, log scale) */
export const regionTarget = (detail) => Math.round(6 * Math.pow(150, detail / 100));

/** Map UI parameters to pipeline parameters for a working image of w x h. */
export function pipelineParams(p, w, h, semVersion = 0) {
  const long = Math.max(w, h), k = regionTarget(p.detail), sc = long / 640;
  const minFrac = 0.00003 * Math.pow(130, p.minRegion / 100);
  return {
    spSize: 12, compactness: 12, semVersion,
    wEdge: p.boundary / 100, semW: (p.semStrength ?? 100) / 100,
    k, minArea: Math.max(3, Math.round(w * h * minFrac)), keepContrast: 28,
    paletteK: p.paletteK | 0,
    shape: {
      smooth: 1 + Math.round((p.simplify / 100) * 3),
      eps: (0.3 + 2.2 * (p.simplify / 100)) * sc * (p.angularity > 70 ? 1.4 : 1),
      fitErr: (0.45 + 1.3 * (p.simplify / 100)) * sc,
      cornerDeg: 38 + 0.35 * (100 - p.angularity),
      angular: p.angularity >= 80,
    },
  };
}
