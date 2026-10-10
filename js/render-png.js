// render-png.js - dependency-free PNG encoder (RGBA, 8-bit) + base64 helper.
import { deflate, crc32 } from './util-deflate.js';
const u32 = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
function chunk(type, data) {
  const t = new TextEncoder().encode(type), body = new Uint8Array(4 + data.length); body.set(t); body.set(data, 4);
  const out = new Uint8Array(12 + data.length); out.set(u32(data.length)); out.set(body, 4); out.set(u32(crc32(body)), 8 + data.length); return out;
}
export async function encodePNG(rgba, w, h) {
  const stride = w * 4, raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1); raw[o] = 1; // Sub filter
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (rgba[y * stride + i] - (i >= 4 ? rgba[y * stride + i - 4] : 0)) & 255;
  }
  const ihdr = new Uint8Array(13); ihdr.set(u32(w)); ihdr.set(u32(h), 4); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
export function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'); }
