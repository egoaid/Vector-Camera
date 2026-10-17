// style-tendency.js - "random style tendency": a BIAS on the random generation, not a restriction.
// A tendency gives weights for the structural choices (mode, tone, halftone type, palette, background, lines) and narrower
// value windows for the parameters, so results usually read as that kind of picture - but every mode, tone and halftone
// combination keeps a non-zero chance where it makes sense, and the sampler (style-space.js) still draws every parameter
// that matters for the structure it picked. With the tendency off the whole space is open. Pure functions (no DOM).
import { sampleLook } from './style-space.js';

/** Tendency ids, in the order of the selector. */
export const TENDENCIES = ['etching', 'engraving', 'silver', 'twotone', 'silkscreen', 'popart', 'vector', 'poster'];

const W = (o) => o; // readability: window tables
export const BIASES = {
  // copperplate etching: etching hatching on paper; mostly screen-print mode, also as an ink drawing over vector colours
  etching: { modes: { hybrid: 6, vector: 2, regions: 1 }, tones: { classic: 1 }, ht: 1, types: { etching: 1 }, bg: ['photo', 'photo', 'paper'], lines: 0, outline: 0.05, angles: [30, 45, 60],
    presets: ['etching', 'etching', 'etchblue', 'sanguine', 'mono', 'kraft'],
    win: W({ detail: [30, 55], simplify: [25, 50], angularity: [0, 40], curveFit: [40, 90], regionSmooth: [35, 70], separation: [3, 3], retention: [45, 75], grain: [0, 15], roughness: [0, 10], misreg: [0, 6], paper: [35, 60],
      halftoneSize: [5, 8], htWeight: [45, 65], htLayers: [2, 3], htSpread: [45, 80], htCurve: [25, 70], htSketch: [30, 65], htLen: [35, 70], htDepth: [30, 80], htContour: [20, 55], htShade: [40, 90], htHairLong: [40, 90], subjectSize: [20, 45] }) },
  // engraving / banknote lines
  engraving: { modes: { hybrid: 6, vector: 1.5, regions: 1 }, tones: { classic: 1 }, ht: 1, types: { engrave: 5, line: 1, cross: 1 }, bg: ['photo', 'photo', 'paper'], lines: 0, outline: 0.05, angles: [20, 30, 45],
    presets: ['unite', 'mono', 'kraft', 'etching', 'etchblue', 'maroon'],
    win: W({ detail: [30, 55], simplify: [25, 50], separation: [3, 4], retention: [55, 85], grain: [0, 12], roughness: [0, 10], misreg: [0, 5], paper: [25, 50], halftoneSize: [4, 7], htWeight: [45, 65], htCurve: [30, 70], htWave: [30, 70], htWaveLen: [30, 70], htGuilloche: [10, 60] }) },
  // silver-gelatin photograph
  silver: { modes: { hybrid: 5, vector: 2, regions: 1 }, tones: { silver: 1 }, ht: 0.2, types: { dot: 3, line: 1 }, bg: ['photo'], lines: 0, outline: 0, angles: [15, 45, 75],
    presets: ['silver', 'silver', 'sepia', 'selenium', 'mono'],
    win: W({ detail: [25, 50], simplify: [20, 40], separation: [5, 6], retention: [80, 100], grain: [30, 75], roughness: [15, 50], misreg: [0, 0], paper: [20, 50], halftoneSize: [3, 6], htMix: [25, 55], subjectSize: [20, 40] }) },
  // strict black and white (lith / photocopy / woodcut look)
  twotone: { modes: { hybrid: 5, vector: 2.5, regions: 1 }, tones: { twotone: 1 }, ht: 0.15, types: { dot: 2, line: 2, etching: 1 }, bg: ['photo', 'photo', 'paper'], lines: 0, outline: 0.1, angles: [15, 45, 75],
    presets: ['mono', 'mono', 'duo', 'etching', 'etchblue', 'sepia', 'riso'],
    win: W({ detail: [28, 55], simplify: [25, 50], ttThreshold: [38, 62], ttAdaptive: [0, 60], ttDetail: [10, 60], ttEdge: [0, 50], ttClean: [0, 40], ttBreakup: [0, 30], paper: [10, 40], misreg: [0, 20], subjectSize: [20, 45] }) },
  // silkscreen / riso: flat inks, misregistration, grain
  silkscreen: { modes: { hybrid: 7, regions: 1.5, vector: 1 }, tones: { classic: 8, twotone: 1 }, ht: 0.6, types: { dot: 5, line: 2, cross: 1 }, bg: ['flat', 'flat', 'photo'], lines: 0.25, outline: 0.15, angles: [15, 45, 75],
    presets: ['riso', 'pop', 'garden', 'lovepop', 'boombox', 'stadium', 'lavender', 'skygreen', 'sunhill', 'tealpink', 'unite', 'bluepeach', 'typewriter', 'field', 'cyan', 'palm'],
    win: W({ detail: [32, 55], separation: [2, 4], retention: [25, 55], grain: [20, 50], roughness: [15, 45], misreg: [35, 80], paper: [35, 65], halftoneSize: [4, 8], subjectSize: [22, 48] }) },
  // pop art: bold flat colour, big dots, black lines
  popart: { modes: { hybrid: 6, regions: 2, vector: 1.5 }, tones: { classic: 1 }, ht: 1, types: { dot: 8, line: 2 }, bg: ['flat'], lines: 0.8, outline: 0.7, angles: [45, 45, 15, 75],
    presets: ['pop', 'pop', 'lovepop', 'royal', 'tealpink', 'stadium', 'lavender', 'riso', 'boombox'],
    win: W({ detail: [28, 50], simplify: [30, 65], angularity: [20, 80], separation: [2, 3], retention: [15, 40], grain: [0, 15], roughness: [0, 15], misreg: [0, 20], paper: [10, 30], halftoneSize: [7, 12], htWeight: [50, 70], lineWidth: [22, 45], outline: [14, 45], subjectSize: [25, 50] }) },
  // flat vector illustration, optionally with a tone / halftone layer on top
  vector: { modes: { vector: 1 }, tones: { classic: 5, silver: 1.5, twotone: 1.5 }, ht: 0.25, types: { dot: 3, line: 2, etching: 2, cross: 1, engrave: 1 }, lines: 0.2, outline: 0.35, angles: [15, 45, 75],
    presets: ['natural', 'natural', 'etching', 'mono', 'silver', 'sepia', 'pop', 'riso'],
    win: W({ detail: [45, 85], simplify: [15, 45], angularity: [0, 45], curveFit: [40, 95], regionSmooth: [35, 85], minRegion: [10, 50], retention: [30, 85], grain: [0, 30], roughness: [0, 30] }) },
  // poster: a few colours (colour regions)
  poster: { modes: { regions: 1 }, tones: { classic: 6, silver: 1, twotone: 1 }, ht: 0.25, types: { dot: 4, line: 2, etching: 1 }, lines: 0.2, outline: 0.4, angles: [15, 45, 75],
    presets: ['natural', 'pop', 'riso', 'lovepop', 'garden', 'sunhill', 'tealpink', 'stadium', 'royal', 'cyan', 'earth', 'olive'],
    win: W({ detail: [25, 55], simplify: [30, 65], angularity: [20, 80], curveFit: [20, 70], regionSmooth: [25, 65], paletteK: [4, 10], retention: [20, 60], grain: [0, 25], roughness: [0, 25] }) },
};

/**
 * Parameter patch for the chosen tendency: the same sampler as the fully random generation, with the tendency's bias.
 * `on` = the ticked targets. Returns the look patch (mode, palette, shape, tone, halftone, texture, background, subject, lines).
 */
export function tendencyPatch(kind, r, on, cur) { return sampleLook(r, cur, on, BIASES[kind] || {}); }
