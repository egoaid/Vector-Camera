// config.js - defaults, limits, presets and slider -> pipeline parameter mapping.
export const MODES = ['vector', 'silhouette', 'regions', 'hybrid'];
export const LIMITS = {
  working: { low: 512, standard: 768, high: 1024 },   // long edge of the segmentation working copy
  sourceMax: 2400,                                     // long edge kept for hybrid raster / PNG export
  exportLong: [1024, 2048, 3072],
  hybridRasterMax: 1600,                               // raster ink resolution embedded in SVG / PDF
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
  separation: 3, retention: 45, halftone: 0, halftoneSize: 6, halftoneAngle: 45,
  grain: 25, roughness: 20, misreg: 25, paper: 25, bgTreatment: 'flat', semStrength: 100,
  exportLong: 2048, wakeLock: true,
};
export const MODE_DEFAULTS = {
  vector: { detail: 62, paletteK: 0, simplify: 30, angularity: 20, outline: 0 },
  silhouette: { detail: 24, paletteK: 0, simplify: 45, angularity: 35, subjectSize: 30 },
  regions: { detail: 40, paletteK: 8, simplify: 40, angularity: 40, paletteMap: 'nearest' },
  hybrid: { detail: 42, paletteK: 0, simplify: 35, angularity: 25, separation: 3, retention: 45, grain: 25, misreg: 25 },
};
export const MODE_PRESETS = { vector: ['natural'], silhouette: ['pop', 'sleeve', 'mono'], regions: ['natural', 'pop', 'sleeve', 'riso', 'duo'], hybrid: ['pop', 'sleeve', 'riso', 'duo', 'mono'] };

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
