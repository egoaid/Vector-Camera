// export-files.js - builds downloadable Blobs for SVG / PDF / PNG / JPEG and triggers a save or share.
import { sceneToSVG } from './render-svg.js';
import { sceneToPDF } from './render-pdf.js';
import { renderToCanvas } from './render-canvas.js';
import { sceneHasRaster } from './style-scene.js';
import { LIMITS } from './config.js';
import { renderPosterPNG } from './render-strips.js';

export const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
export const fileName = (scene, ext) => `vector-camera_${scene.mode}_${stamp()}.${ext}`;

export async function makeBlob(kind, scene, geom, { longPx = 2048, onProgress } = {}) {
  if (kind === 'poster') return renderPosterPNG(scene, geom, longPx, onProgress);
  if (kind === 'svg') {
    const k = longPx / Math.max(scene.w, scene.h);
    return new Blob([await sceneToSVG(scene, geom, { outW: Math.round(scene.w * k), outH: Math.round(scene.h * k) })], { type: 'image/svg+xml' });
  }
  if (kind === 'pdf') return new Blob([await sceneToPDF(scene, geom, { longPt: LIMITS.pdfLongPt })], { type: 'application/pdf' });
  const cv = renderToCanvas(scene, geom, longPx), type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((res) => cv.toBlob(res, type, 0.93)); cv.width = 0; return blob;
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const canShareFiles = (blob, name) => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: blob.type })] })); } catch { return false; } };
export async function share(blob, name) { await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: 'Vector Camera' }); }
export { sceneHasRaster };
