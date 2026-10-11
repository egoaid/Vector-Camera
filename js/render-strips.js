// render-strips.js - poster-size raster export. The scene is drawn in horizontal strips (so a 70+ megapixel poster never
// needs one giant canvas) and the pixels are streamed straight into a PNG deflate stream. Vector parts are re-drawn from
// their paths at the target size, so edges stay perfectly sharp; vectorised ink (halftone dots) too.
import { drawScene } from './render-canvas.js';
import { crc32 } from './util-deflate.js';

const u32 = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
function chunk(type, data) {
  const t = new TextEncoder().encode(type), body = new Uint8Array(4 + data.length); body.set(t); body.set(data, 4);
  const out = new Uint8Array(12 + data.length); out.set(u32(data.length)); out.set(body, 4); out.set(u32(crc32(body)), 8 + data.length); return out;
}
export const posterSize = (scene, longPx) => { const k = longPx / Math.max(scene.w, scene.h); return [Math.max(1, Math.round(scene.w * k)), Math.max(1, Math.round(scene.h * k))]; };

/** Renders the scene at W x H pixels and returns a PNG Blob. onProgress(0..1). Uses CompressionStream (all current browsers). */
export async function renderPosterPNG(scene, geom, longPx, onProgress = () => {}) {
  if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream unsupported');
  const [W, H] = posterSize(scene, longPx), k = W / scene.w, stripH = Math.max(16, Math.min(512, Math.floor(6e6 / W)));
  const cs = new CompressionStream('deflate'), writer = cs.writable.getWriter(), reader = cs.readable.getReader(), parts = [];
  const ihdr = new Uint8Array(13); ihdr.set(u32(W)); ihdr.set(u32(H), 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB (no alpha: smaller, print-friendly)
  parts.push(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', ihdr));
  const pump = (async () => { for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(chunk('IDAT', value)); } })();
  const cv = document.createElement('canvas'); cv.width = W; const stride = W * 3;
  for (let y0 = 0; y0 < H; y0 += stripH) {
    const hh = Math.min(stripH, H - y0); cv.height = hh;
    drawScene(cv, scene, geom, { scale: k, offsetY: y0, paper: true, paperTotalW: W });
    const px = cv.getContext('2d').getImageData(0, 0, W, hh).data, raw = new Uint8Array((stride + 1) * hh);
    for (let y = 0; y < hh; y++) {
      const o = y * (stride + 1); raw[o] = 1; let prev = [0, 0, 0];
      for (let x = 0, s = y * W * 4, d = o + 1; x < W; x++, s += 4, d += 3) { const r = px[s], g = px[s + 1], b = px[s + 2]; raw[d] = (r - prev[0]) & 255; raw[d + 1] = (g - prev[1]) & 255; raw[d + 2] = (b - prev[2]) & 255; prev[0] = r; prev[1] = g; prev[2] = b; }
    }
    await writer.write(raw); onProgress(Math.min(1, (y0 + hh) / H));
    await new Promise((r) => setTimeout(r, 0));
  }
  cv.width = 0; await writer.close(); await pump;
  parts.push(chunk('IEND', new Uint8Array(0)));
  return new Blob(parts, { type: 'image/png' });
}
