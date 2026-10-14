// seg-semantic.js - semantic label map helpers + coarse ADE20K group hints (bg / mid / fg).
const BG = ['sky', 'wall', 'building', 'floor', 'ceiling', 'road', 'grass', 'earth', 'mountain', 'field', 'sand', 'sea', 'water', 'river', 'hill', 'rock', 'sidewalk', 'skyscraper', 'wall', 'lake', 'waterfall', 'dirt track', 'path', 'runway', 'stairs', 'bridge'];
const MID = ['tree', 'plant', 'fence', 'railing', 'house', 'door', 'windowpane', 'curtain', 'column', 'pole', 'streetlight', 'signboard', 'awning', 'palm', 'flower', 'bush', 'hovel', 'tower', 'fountain', 'bench'];
export function groupHint(name) {
  if (!name) return -1;
  const n = String(name).toLowerCase();
  if (BG.some((b) => n === b || n.startsWith(b + ','))) return 0;
  if (MID.some((b) => n === b || n.startsWith(b + ','))) return 1;
  return 2;
}
/** Nearest-neighbour resample of a label map to the working size. */
export function resampleLabels(src, sw, sh, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const sy = Math.min(sh - 1, (y * sh / h) | 0); for (let x = 0; x < w; x++) out[y * w + x] = src[sy * sw + Math.min(sw - 1, (x * sw / w) | 0)]; }
  return out;
}
