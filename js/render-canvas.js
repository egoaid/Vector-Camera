// render-canvas.js - draws a scene to a 2D canvas (preview, PNG / JPEG export). Vector paths are rendered via Path2D
// at the target resolution, so the preview of a vector mode stays crisp at any size.
import { groupPathD } from './vec-geometry.js';
import { hexToRgb } from './color-utils.js';
import { paperNoise } from './render-ink.js';

function inkCanvas(b) {
  if (b._cv) return b._cv;
  const cv = document.createElement('canvas'); cv.width = b.w; cv.height = b.h;
  cv.getContext('2d').putImageData(new ImageData(b.rgba, b.w, b.h), 0, 0); b._cv = cv; return cv;
}
export function releaseScene(scene) { for (const L of scene.layers) if (L.bitmap) { if (L.bitmap._cv) { L.bitmap._cv.width = 0; L.bitmap._cv = null; } } }

/** Draw scene scaled to the canvas size. opts: { transparent, paper (bool) } */
export function drawScene(canvas, scene, geom, opts = {}) {
  const ctx = canvas.getContext('2d'), s = canvas.width / scene.w;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!opts.transparent) { ctx.fillStyle = scene.paper; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  for (const L of scene.layers) {
    if (L.kind === 'rect') { ctx.fillStyle = L.fill; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else if (L.kind === 'fills') {
      ctx.save(); ctx.translate(L.offset[0] * s, L.offset[1] * s); ctx.lineJoin = 'round';
      for (const it of L.items) {
        const key = 'p' + s.toFixed(4); const p2 = (it._p ||= {})[key] || (it._p[key] = new Path2D(groupPathD(geom, it.regions, { scale: s, prec: 2 })));
        ctx.fillStyle = it.fill; ctx.fill(p2, 'evenodd');
        if (L.stroke) { ctx.strokeStyle = L.stroke.color; ctx.lineWidth = L.stroke.w * s; ctx.stroke(p2); }
        else if (L.seal) { ctx.strokeStyle = it.fill; ctx.lineWidth = L.seal * s; ctx.stroke(p2); }
      }
      ctx.restore();
    } else if (L.kind === 'ink') {
      const b = L.bitmap, key = 'c' + s.toFixed(4); const p2 = (L._p ||= {})[key] || (L._p[key] = new Path2D(groupPathD(geom, L.regions, { scale: s, prec: 2 })));
      ctx.save(); ctx.clip(p2, 'evenodd'); ctx.globalCompositeOperation = L.blend === 'multiply' ? 'multiply' : 'source-over';
      ctx.drawImage(inkCanvas(b), b.gx * s, b.gy * s, b.gw * s, b.gh * s); ctx.restore();
    }
  }
  ctx.restore();
  if (scene.paperAmount > 0 && opts.paper !== false) applyPaper(canvas, scene.paperAmount);
}
/** Subtle paper fibre / grain: multiplies a deterministic noise field over the finished image (raster outputs only). */
export function applyPaper(canvas, amount) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, id = ctx.getImageData(0, 0, W, H), d = id.data, k = amount * 0.22, f = Math.max(1, W / 900);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = paperNoise(Math.floor(x / f), Math.floor(y / f)), m = 1 - k * (1 - n) * 1.3, o = (y * W + x) * 4; d[o] *= m; d[o + 1] *= m; d[o + 2] *= m; }
  ctx.putImageData(id, 0, 0);
}
export function renderToCanvas(scene, geom, longPx, opts = {}) {
  const k = longPx / Math.max(scene.w, scene.h), cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(scene.w * k)); cv.height = Math.max(1, Math.round(scene.h * k)); drawScene(cv, scene, geom, opts); return cv;
}
export { hexToRgb };
