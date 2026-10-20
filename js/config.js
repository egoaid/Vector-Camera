// config.js - defaults, limits, presets and slider -> pipeline parameter mapping.
export const MODES = ['vector', 'silhouette', 'regions', 'hybrid', 'watercolor'];
/** Modes whose picture can carry the tone (silver / two-tone) and halftone ink: hybrid (the main use) and, as an overlay on the photo-colour fills, vector and regions. */
export const INK_MODES = ['vector', 'regions', 'hybrid'];
/** true when the params ask for tone or halftone ink on a vector / regions picture (classic tone and halftone off = a plain vector picture, nothing overlaid). */
export const overlayInk = (p) => (p.mode === 'vector' || p.mode === 'regions') && (p.tone === 'silver' || p.tone === 'twotone' || p.halftone > 0);
/** true when an ink factory is needed at all (hybrid always; vector / regions only with an overlay). */
export const needsInk = (p) => p.mode === 'hybrid' || p.mode === 'watercolor' || overlayInk(p);
export const LIMITS = {
  working: { low: 512, standard: 768, high: 1024 },   // long edge of the segmentation working copy
  sourceMax: 2400,                                     // long edge kept for hybrid raster / PNG export
  exportLong: [1024, 2048, 3072],
  liteLong: 1280, hybridRasterMax: 1600,                               // raster ink resolution embedded in SVG / PDF
  pdfLongPt: 841.89,
};
export const DEFAULT_PARAMS = {
  mode: 'hybrid', preset: 'pop', quality: 'standard',
  detail: 45, boundary: 50, simplify: 35, angularity: 25, curveFit: 40, regionSmooth: 50, minRegion: 30, subjectSize: 30,
  paletteK: 8, paletteMap: 'luma',
  seal: true, outline: 0, outlineColor: '#111111', background: 'auto',
  silColors: { bg: '#f2d934', mid: '#e1456d', fg: '#17121c' }, silSample: false,
  separation: 3, retention: 45, halftone: 0, halftoneType: 'dot', htWeight: 50, htLayers: 3, htSpread: 60, htCurve: 40, htSketch: 40, htWave: 50, htWaveLen: 50, htGuilloche: 40, htLen: 50, htDepth: 45, htContour: 35, htKinds: 70, htFlow: 0, htShade: 60, htHairLong: 60, htRegSkin: 50, htRegHair: 50, htRegEyes: 50, htRegBrows: 50, htRegNose: 50, htRegLips: 50, htRegCheek: 0, faceEngine: 'modern', htColor: '', lock: { palette: false, htColor: false, lineColor: false }, halftoneSize: 6, halftoneAngle: 45,
  grain: 25, roughness: 20, misreg: 25, paper: 25, bgTreatment: 'flat', semStrength: 100,
  // photographic tone treatment (hybrid mode): 'classic' = the original levels / grain; 'silver' = silver-gelatin; 'twotone' = strict black-and-white threshold (see tone-photo.js)
  tone: 'classic', sgBlack: 0, sgWhite: 100, sgContrast: 50, sgCurve: 50, sgGrain: 35, sgGrainSize: 40, sgGrainRough: 40, sgToning: 'none', sgToningAmt: 60,
  ttThreshold: 50, ttBias: 50, ttAdaptive: 0, ttDetail: 30, ttEdge: 0, ttClean: 20, ttBreakup: 0, ttStrict: true, htMix: 70,
  exportLong: 2048, wakeLock: true,
  lineWidth: 0, lineColor: '#17121c', lineColor2: '#ff7a3a', lineOffset: 0, lineScope: 'mid',
  text: 'Vector Camera', textLang: 'en', textFont: 'anton', textSize: 16, textX: 50, textY: 78, textAngle: 0, textSpacing: 2, textColor: '#fff4f4', textShadow: 20, textShadowColor: '#17121c', textShow: false, textHalftone: 0, textHalftoneType: 'dot', textHalftoneSize: 5, textHalftoneAngle: 45, textHalftoneMode: 'down', textWear: 0, textDirt: 0, textSeed: 1,
  frame: 0, framePlate: 55, framePlateN: 2, frameRub: 35, frameSplat: 30, frameStain: 30, frameShift: 15, frameColor: '', frameSeed: 1, lightDir: 45, inkStain: 0, inkSplat: 0, inkSeed: 1, wcPaper: 'cold', wcBleed: 45, wcEdge: 50, wcGran: 50, wcLight: 30, wcHl: 40, wcBloom: 35, wcBrush: 50, wcLayer: 50, wcSeed: 1, hueShift: 0, // paper margin around the picture (style-frame.js): width, extra bottom, ink bleed, edge wear, crookedness
  vecInk: false, vecInkLong: 1400, vecInkSpeck: 2,
  collageLayout: 'torn', collageAspect: '4:5', collageSlots: 0, collageTorn: 60, collageGap: 30, collageRotate: 40, collageVary: false, collageSeed: 1, collagePaper: '', collageEdge: 'organic',
  rndOpts: { mode: true, palette: true, shape: true, tone: true, halftone: true, texture: true, background: true, subject: true, lines: true, frame: true, font: true, textOn: false, textFx: true, collage: true, aspect: true },
  customPreset: null, rndStyle: 'off',
  // text slots 2 and 3 (keys get a _1 / _2 suffix); slot 1 uses the plain keys above
  text_1: '', textLang_1: 'en', textFont_1: 'marker', textSize_1: 11, textX_1: 50, textY_1: 22, textAngle_1: 0, textSpacing_1: 2, textColor_1: '#ffd23f', textShadow_1: 20, textShadowColor_1: '#17121c', textShow_1: false, textHalftone_1: 0, textHalftoneType_1: 'dot', textHalftoneSize_1: 5, textHalftoneAngle_1: 45, textHalftoneMode_1: 'down', textWear_1: 0, textDirt_1: 0, textSeed_1: 2,
  text_2: '', textLang_2: 'en', textFont_2: 'typewriter', textSize_2: 9, textX_2: 50, textY_2: 50, textAngle_2: 0, textSpacing_2: 2, textColor_2: '#ffffff', textShadow_2: 0, textShadowColor_2: '#17121c', textShow_2: false, textHalftone_2: 0, textHalftoneType_2: 'dot', textHalftoneSize_2: 5, textHalftoneAngle_2: 45, textHalftoneMode_2: 'down', textWear_2: 0, textDirt_2: 0, textSeed_2: 3,
};
export const TEXT_SLOTS = 3;
export const TEXT_BASE = ['text', 'textLang', 'textFont', 'textSize', 'textX', 'textY', 'textAngle', 'textSpacing', 'textColor', 'textShadow', 'textShadowColor', 'textShow', 'textHalftone', 'textHalftoneType', 'textHalftoneSize', 'textHalftoneAngle', 'textHalftoneMode', 'textWear', 'textDirt', 'textSeed'];
/** Parameter key of text slot `i` (0..2): slot 0 uses the plain key, others get _1 / _2. */
export const tkey = (k, i) => (i ? `${k}_${i}` : k);
/** A view of slot `i` with the plain key names (what style-text / text-fx read). */
export const slotView = (p, i) => { const o = {}; for (const k of TEXT_BASE) o[k] = p[tkey(k, i)]; for (const k of HT_KEYS) o[k] = p[k]; return o; };
/** Rotate an offset (dx,dy) from the classic light direction (45deg) to `lightDir` degrees. 45 returns the input untouched (old results stay identical). */
export const rotOff = (dx, dy, dir) => { const d = ((dir ?? 45) - 45) * Math.PI / 180; if (!d) return [dx, dy]; const c = Math.cos(d), s = Math.sin(d); return [dx * c - dy * s, dx * s + dy * c]; };
export const HT_KEYS = ['lightDir', 'htWeight', 'htLayers', 'htSpread', 'htCurve', 'htSketch', 'htWave', 'htWaveLen', 'htGuilloche', 'htLen', 'htDepth', 'htContour'];
export const MODE_DEFAULTS = {
  watercolor: { detail: 36, simplify: 40, angularity: 15, curveFit: 40, regionSmooth: 45, paletteK: 0, inkStain: 25, inkSplat: 12 },
  vector: { detail: 62, paletteK: 0, simplify: 30, angularity: 20, outline: 0 },
  silhouette: { detail: 24, paletteK: 0, simplify: 45, angularity: 35, subjectSize: 30 },
  regions: { detail: 40, paletteK: 8, simplify: 40, angularity: 40, paletteMap: 'nearest' },
  hybrid: { detail: 42, paletteK: 0, simplify: 35, angularity: 25, separation: 3, retention: 45, grain: 25, misreg: 25 },
};
const STYLES = ['pop', 'sleeve', 'riso', 'duo', 'mono', 'unite', 'garden', 'lovepop', 'olive', 'earth', 'field', 'stripes', 'maroon', 'boombox', 'stadium', 'lavender', 'skygreen', 'bluepeach', 'kraft', 'palm', 'typewriter', 'sunhill', 'cyan', 'royal', 'tealpink', 'etching', 'etchblue', 'sanguine', 'silver', 'sepia', 'selenium'];
export const MODE_PRESETS = { vector: ['natural', ...STYLES], silhouette: STYLES, regions: ['natural', ...STYLES], hybrid: STYLES, watercolor: ['natural'] };

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
      smooth: 1 + Math.round((p.simplify / 100) * 3) + Math.round(((p.curveFit ?? 0) / 100) * 6 * Math.min(2, sc)), // curveFit: more smoothing passes ...
      eps: (0.3 + 2.2 * (p.simplify / 100)) * sc * (p.angularity > 70 ? 1.4 : 1) * (1 + 0.35 * (p.curveFit ?? 0) / 100),
      fitErr: (0.45 + 1.3 * (p.simplify / 100)) * sc * (1 + 0.5 * (p.curveFit ?? 0) / 100),
      cornerDeg: Math.min(150, 38 + 0.35 * (100 - p.angularity) + 0.4 * (p.curveFit ?? 0)), // ... and fewer corners: only really sharp turns stay corners
      angular: p.angularity >= 80,
      round: ((p.regionSmooth ?? 0) / 100) * 12 * sc * 0.85, // px radius at which stair-stepped region borders are rounded
    },
  };
}
