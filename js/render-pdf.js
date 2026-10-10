// render-pdf.js - minimal PDF 1.4 writer: native path operators (m l c h, f*, W*) for all vector geometry;
// hybrid ink layers are embedded as Flate-compressed image XObjects (+ SMask) clipped by vector paths.
import { deflate } from './util-deflate.js';
import { reversePath } from './vec-curves.js';
import { hexToRgb } from './color-utils.js';
import { APP_NAME, APP_VERSION } from './version.js';

const num = (v) => { const s = (+v).toFixed(3); return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); };
const col = (hex) => hexToRgb(hex).map((c) => num(c / 255)).join(' ');
function regionOps(geom, regions) {
  geom._rev ||= new Map(); const out = [];
  for (const r of regions) for (const loop of geom.loops[r]) {
    let first = true;
    for (const code of loop) {
      const ci = code >> 1; let p = geom.chains[ci];
      if (!(code & 1)) { let q = geom._rev.get(ci); if (!q) { q = reversePath(p); geom._rev.set(ci, q); } p = q; }
      const { cmds, pts } = p; if (first) { out.push(`${num(pts[0])} ${num(pts[1])} m`); first = false; }
      let o = 2;
      for (let i = 0; i < cmds.length; i++) {
        if (cmds[i] === 3) { out.push(`${num(pts[o])} ${num(pts[o + 1])} ${num(pts[o + 2])} ${num(pts[o + 3])} ${num(pts[o + 4])} ${num(pts[o + 5])} c`); o += 6; }
        else { out.push(`${num(pts[o])} ${num(pts[o + 1])} l`); o += 2; }
      }
    }
    out.push('h');
  }
  return out.join('\n');
}
const enc = new TextEncoder();
class PDF {
  constructor() { this.objs = []; }
  add(dict, stream) { this.objs.push({ dict, stream }); return this.objs.length; }
  reserve() { this.objs.push(null); return this.objs.length; }
  set(id, dict, stream) { this.objs[id - 1] = { dict, stream }; }
  build(root, info) {
    const chunks = [], offs = []; let len = 0;
    const push = (u8) => { chunks.push(u8); len += u8.length; };
    push(enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[\u0080-￿]/g, (c) => c)));
    this.objs.forEach((o, i) => {
      offs.push(len); push(enc.encode(`${i + 1} 0 obj\n`));
      if (o.stream) { push(enc.encode(o.dict.replace(/>>$/, `/Length ${o.stream.length}>>`) + '\nstream\n')); push(o.stream); push(enc.encode('\nendstream\n')); }
      else push(enc.encode(o.dict + '\n'));
      push(enc.encode('endobj\n'));
    });
    const xref = len; let x = `xref\n0 ${this.objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offs) x += String(o).padStart(10, '0') + ' 00000 n \n';
    x += `trailer\n<</Size ${this.objs.length + 1}/Root ${root} 0 R/Info ${info} 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
    push(enc.encode(x));
    const out = new Uint8Array(len); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
  }
}
/** opts: { longPt, title } -> Uint8Array (PDF). */
export async function sceneToPDF(scene, geom, opts = {}) {
  const longPt = opts.longPt || 841.89, k = longPt / Math.max(scene.w, scene.h), W = scene.w * k, H = scene.h * k;
  const pdf = new PDF(), catalog = pdf.reserve(), pages = pdf.reserve(), page = pdf.reserve(), content = pdf.reserve();
  const xobj = [], gs = new Map(); let ops = [`q ${num(k)} 0 0 ${num(-k)} 0 ${num(H)} cm`, `${col(scene.paper)} rg`, `0 0 ${num(scene.w)} ${num(scene.h)} re f`];
  let imN = 0;
  for (const L of scene.layers) {
    if (L.kind === 'rect') ops.push(`${col(L.fill)} rg`, `0 0 ${num(scene.w)} ${num(scene.h)} re f`);
    else if (L.kind === 'fills') {
      ops.push('q', `1 0 0 1 ${num(L.offset[0])} ${num(L.offset[1])} cm`, '1 j');
      for (const it of L.items) {
        ops.push(`${col(it.fill)} rg`, regionOps(geom, it.regions));
        if (L.stroke) ops.push(`${col(L.stroke.color)} RG ${num(L.stroke.w)} w`, 'B*');
        else if (L.seal) ops.push(`${col(it.fill)} RG ${num(L.seal)} w`, 'B*'); else ops.push('f*');
      }
      ops.push('Q');
    } else if (L.kind === 'ink') {
      const b = L.bitmap, name = `Im${++imN}`, n = b.w * b.h, rgb = new Uint8Array(n * 3), al = new Uint8Array(n); let opaque = true;
      for (let i = 0; i < n; i++) { rgb[i * 3] = b.rgba[i * 4]; rgb[i * 3 + 1] = b.rgba[i * 4 + 1]; rgb[i * 3 + 2] = b.rgba[i * 4 + 2]; al[i] = b.rgba[i * 4 + 3]; if (al[i] !== 255) opaque = false; }
      let sm = ''; if (!opaque) { const sid = pdf.add(`<</Type/XObject/Subtype/Image/Width ${b.w}/Height ${b.h}/ColorSpace/DeviceGray/BitsPerComponent 8/Filter/FlateDecode>>`, await deflate(al)); sm = `/SMask ${sid} 0 R`; }
      const id = pdf.add(`<</Type/XObject/Subtype/Image/Width ${b.w}/Height ${b.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Interpolate true/Filter/FlateDecode${sm}>>`, await deflate(rgb));
      xobj.push(`/${name} ${id} 0 R`);
      let g = ''; if (L.blend === 'multiply') { if (!gs.has('M')) gs.set('M', '/GSm <</Type/ExtGState/BM/Multiply>>'); g = '/GSm gs'; }
      ops.push('q', regionOps(geom, L.regions), 'W* n', g, `${num(b.gw)} 0 0 ${num(-b.gh)} ${num(b.gx)} ${num(b.gy + b.gh)} cm`, `/${name} Do`, 'Q');
    }
  }
  ops.push('Q');
  const stream = await deflate(enc.encode(ops.join('\n')));
  pdf.set(content, '<</Filter/FlateDecode>>', stream);
  pdf.set(catalog, `<</Type/Catalog/Pages ${pages} 0 R>>`);
  pdf.set(pages, `<</Type/Pages/Kids[${page} 0 R]/Count 1>>`);
  pdf.set(page, `<</Type/Page/Parent ${pages} 0 R/MediaBox[0 0 ${num(W)} ${num(H)}]/Contents ${content} 0 R/Resources<<${xobj.length ? `/XObject<<${xobj.join(' ')}>>` : ''}${gs.size ? `/ExtGState<<${[...gs.values()].join(' ')}>>` : ''}>>>>`);
  const title = (opts.title || APP_NAME).replace(/[^\x20-\x7e]/g, '?').replace(/[()\\]/g, '');
  const info = pdf.add(`<</Title(${title})/Producer(${APP_NAME} v${APP_VERSION})/Creator(${APP_NAME})>>`);
  return pdf.build(catalog, info);
}
