// util-deflate.js - zlib deflate (CompressionStream when available, stored blocks otherwise) + crc32 / adler32.
export async function deflate(bytes) {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate'), w = cs.writable.getWriter();
      w.write(bytes); w.close();
      return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    } catch (e) { /* fall through to stored */ }
  }
  return deflateStored(bytes);
}
export function adler32(b) { let a = 1, s = 0; for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; s = (s + a) % 65521; } return ((s << 16) | a) >>> 0; }
export function deflateStored(b) {
  const blocks = Math.max(1, Math.ceil(b.length / 65535)), out = new Uint8Array(2 + b.length + blocks * 5 + 4);
  out[0] = 0x78; out[1] = 0x01; let o = 2;
  for (let i = 0; i < blocks; i++) {
    const s = i * 65535, n = Math.min(65535, b.length - s), last = i === blocks - 1 ? 1 : 0;
    out[o++] = last; out[o++] = n & 255; out[o++] = n >> 8; out[o++] = ~n & 255; out[o++] = (~n >> 8) & 255; out.set(b.subarray(s, s + n), o); o += n;
  }
  const ad = adler32(b); out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 255; out[o++] = (ad >>> 8) & 255; out[o++] = ad & 255;
  return out;
}
let T; export function crc32(b) { if (!T) { T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } } let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
