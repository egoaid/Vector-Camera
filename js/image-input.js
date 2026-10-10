// image-input.js - decoding user images (EXIF-aware), alpha flattening, working-copy / source-copy creation.
import { LIMITS } from './config.js';

async function decode(blobOrCanvas) {
  if (blobOrCanvas instanceof HTMLCanvasElement) return blobOrCanvas;
  try { return await createImageBitmap(blobOrCanvas, { imageOrientation: 'from-image' }); } catch { /* fall back to <img> */ }
  const url = URL.createObjectURL(blobOrCanvas);
  try { const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
const dims = (s) => [s.naturalWidth || s.videoWidth || s.width, s.naturalHeight || s.videoHeight || s.height];
function scaledCanvas(src, longEdge) {
  const [sw, sh] = dims(src), k = Math.min(1, longEdge / Math.max(sw, sh)), cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); // flatten alpha on white
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, cv.width, cv.height); return cv;
}
/** Returns { source: {w,h,data}, original: HTMLCanvasElement(display copy) }. Never upscales. */
export async function loadSource(file) {
  const src = await decode(file);
  const cv = scaledCanvas(src, LIMITS.sourceMax); if (src.close) src.close();
  const ctx = cv.getContext('2d', { willReadFrequently: true }), id = ctx.getImageData(0, 0, cv.width, cv.height);
  return { source: { w: cv.width, h: cv.height, data: id.data }, canvas: cv };
}
/** Working copy for segmentation (long edge = quality setting, never upscaled). */
export function makeWorking(sourceCanvas, quality) {
  const long = LIMITS.working[quality] || LIMITS.working.standard, cv = scaledCanvas(sourceCanvas, long);
  const id = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height);
  cv.width = 0; return { w: id.width, h: id.height, data: id.data };
}
