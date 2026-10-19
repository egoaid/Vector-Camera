// render-canvas.js - draws a scene to a 2D canvas (preview, PNG / JPEG export, poster strips).
// Scene layers (see ARCHITECTURE.md "Scene model"): rect | fills | ink | group. Every layer may carry its own `geom`
// (otherwise the parent's is used). Vector paths are Path2D objects built once in scene units and drawn through the
// canvas transform, so the same cached path serves the preview, the PNG export and every poster strip.
import { groupPathD } from './vec-geometry.js';
import { hexToRgb } from './color-utils.js';
import { paperNoise } from './render-ink.js';

function inkCanvas(b) {
  if (b._cv) return b._cv;
  const cv = document.createElement('canvas'); cv.width = b.w; cv.height = b.h;
  cv.getContext('2d').putImageData(new ImageData(b.rgba, b.w, b.h), 0, 0); b._cv = cv; return cv;
}
export function releaseScene(scene) {
  const walk = (layers) => { for (const L of layers) { if (L.bitmap && L.bitmap._cv && !L.bitmap._shared) { L.bitmap._cv.width = 0; L.bitmap._cv = null; } if (L.layers) walk(L.layers); L._p2 = null; if (L.items) for (const it of L.items) it._p2 = null; } };
  walk(scene.layers);
}
const polyPath = (xy) => { const p = new Path2D(); p.moveTo(xy[0], xy[1]); for (let i = 2; i < xy.length; i += 2) p.lineTo(xy[i], xy[i + 1]); p.closePath(); return p; };
const itemPath = (it, geom) => it._p2 || (it._p2 = new Path2D(groupPathD(geom, it.regions, { prec: 3 })));
const clipPath = (L, geom) => L._p2 || (L._p2 = new Path2D(groupPathD(L.clip.geom || geom, L.clip.regions, { prec: 3 })));

function drawLayers(ctx, layers, geom) {
  for (const L of layers) {
    const g = L.geom || geom;
    if (L.kind === 'rect') { ctx.fillStyle = L.fill; ctx.fillRect(-1e5, -1e5, 2e5, 2e5); }
    else if (L.kind === 'fills') {
      ctx.save(); if (L.clip) ctx.clip(clipPath(L, geom), 'evenodd');
      if (L.offset && (L.offset[0] || L.offset[1])) ctx.translate(L.offset[0], L.offset[1]);
      ctx.lineJoin = 'round'; if (L.blend === 'multiply') ctx.globalCompositeOperation = 'multiply';
      const rule = L.rule === 'nonzero' ? 'nonzero' : 'evenodd';
      for (const it of L.items) {
        const p2 = itemPath(it, g);
        if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(p2, rule); }
        if (L.stroke) { ctx.strokeStyle = L.stroke.color; ctx.lineWidth = L.stroke.w; ctx.stroke(p2); }
        else if (L.seal && it.fill) { ctx.strokeStyle = it.fill; ctx.lineWidth = L.seal; ctx.stroke(p2); }
      }
      ctx.restore();
    } else if (L.kind === 'ink') {
      const b = L.bitmap; ctx.save(); if (!L.noClip) ctx.clip(L._p2 || (L._p2 = new Path2D(groupPathD(g, L.regions, { prec: 3 }))), 'evenodd');
      ctx.globalCompositeOperation = L.blend === 'multiply' ? 'multiply' : 'source-over'; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(inkCanvas(b), b.gx, b.gy, b.gw, b.gh); ctx.restore();
    } else if (L.kind === 'group') {
      ctx.save();
      if (L.clipPoly) ctx.clip(L._pp || (L._pp = polyPath(L.clipPoly)), 'evenodd');
      ctx.transform(...L.tf);
      if (L.paper) { ctx.fillStyle = L.paper; ctx.fillRect(0, 0, L.w, L.h); }
      drawLayers(ctx, L.layers, L.geom || geom);
      ctx.restore();
    }
  }
}

/** Draw the scene scaled to the canvas width. opts: { transparent, paper:false, offsetY (px, for strips), scale (override) } */
export function drawScene(canvas, scene, geom, opts = {}) {
  const ctx = canvas.getContext('2d'), s = opts.scale || canvas.width / scene.w, oy = opts.offsetY || 0;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!opts.transparent) { ctx.fillStyle = scene.paper; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.setTransform(s, 0, 0, s, 0, -oy);
  drawLayers(ctx, scene.layers, geom || scene.geom);
  ctx.restore();
  if (scene.paperAmount > 0 && opts.paper !== false) applyPaper(canvas, scene.paperAmount, oy, opts.paperTotalW || canvas.width);
}
/** Subtle paper fibre / grain: multiplies a deterministic noise field over the finished image (raster outputs only). */
export function applyPaper(canvas, amount, yOff = 0, totalW = canvas.width) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, id = ctx.getImageData(0, 0, W, H), d = id.data, k = amount * 0.22, f = Math.max(1, totalW / 900);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = paperNoise(Math.floor(x / f), Math.floor((y + yOff) / f)), m = 1 - k * (1 - n) * 1.3, o = (y * W + x) * 4; d[o] *= m; d[o + 1] *= m; d[o + 2] *= m; }
  ctx.putImageData(id, 0, 0);
}
export function renderToCanvas(scene, geom, longPx, opts = {}) {
  const k = longPx / Math.max(scene.w, scene.h), cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(scene.w * k)); cv.height = Math.max(1, Math.round(scene.h * k)); drawScene(cv, scene, geom, opts); return cv;
}
export { hexToRgb };
