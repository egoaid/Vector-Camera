// style-palette.js - print-style presets (original palettes, loosely inspired by pop-art screen prints and
// retro record-sleeve graphics) and colour mapping helpers.
import { hexToRgb, luma, rgbToLab } from './color-utils.js';

export const PRESETS = {
  natural: { id: 'natural', mode: 'key', ink: '#17121c', paper: '#f6efe2', groups: null },
  pop: { id: 'pop', bgTreatment: 'flat', mode: 'key', ink: '#17121c', paper: '#f6efe2', groups: {
    bg: { block: ['#cf4766'], ink: false }, mid: { block: ['#3cb7c9', '#e8d655'], ink: true }, fg: { block: ['#7d3a8a', '#cf4766', '#e8d655', '#f1c9b0'], ink: true } } },
  sleeve: { id: 'sleeve', bgTreatment: 'photo', mode: 'bands', ink: '#4a1626', paper: '#efe4cf', groups: {
    bg: { block: ['#7f8ab8', '#b58f6e'], ramp: ['#703540', '#ce8a7e', '#e3cfb6'], ink: true },
    mid: { block: ['#ce8a7e', '#a9bd7a'], ramp: ['#703540', '#9a5c5d', '#ce8a7e'], ink: true },
    fg: { block: ['#e3cfb6'], ramp: ['#4e1727', '#a3475c', '#e9d7bd'], ink: true } } },
  riso: { id: 'riso', bgTreatment: 'flat', mode: 'key', ink: '#1f2a7a', paper: '#fbf3e4', groups: {
    bg: { block: ['#ffb8cf'], ink: false }, mid: { block: ['#ff6a3d', '#ffd23f'], ink: true }, fg: { block: ['#ff6a3d', '#ffd1b8', '#ffd23f'], ink: true } } },
  duo: { id: 'duo', bgTreatment: 'photo', mode: 'bands', ink: '#0b1d4a', paper: '#fff1d6', groups: {
    bg: { block: ['#ff5a8a'], ramp: ['#101a4f', '#ff5a8a', '#fff1d6'], ink: true },
    mid: { block: ['#ff5a8a'], ramp: ['#101a4f', '#6a4fb0', '#ff9db8'], ink: true },
    fg: { block: ['#fff1d6'], ramp: ['#101a4f', '#ff5a8a', '#fff1d6'], ink: true } } },
  mono: { id: 'mono', bgTreatment: 'flat', mode: 'key', ink: '#111111', paper: '#f4efe6', groups: {
    bg: { block: ['#f4efe6'], ink: false }, mid: { block: ['#d9d2c3'], ink: true }, fg: { block: ['#f4efe6', '#d9d2c3'], ink: true } } },
};

// ---- v0.2 styles: original palettes studied from 20 reference prints (colour relationships only - no artwork is reproduced) ----
const G = (block, ink = true, ramp) => ({ block, ink, ...(ramp ? { ramp } : {}) });
const K = (id, ink, paper, bg, mid, fg, bgTreatment = 'flat', extras) => ({ id, mode: 'key', ink, paper, bgTreatment, groups: { bg, mid, fg }, ...(extras ? { extras } : {}) });
const B = (id, paper, bgBlocks, r, bgTreatment = 'photo', extras) => ({ id, mode: 'bands', ink: r.fg[0], paper, bgTreatment, groups: { bg: G(bgBlocks, true, r.bg), mid: G([r.mid[1]], true, r.mid), fg: G([r.fg[2]], true, r.fg) }, ...(extras ? { extras } : {}) });
Object.assign(PRESETS, {
  unite: K('unite', '#1f4fa3', '#fbe9e6', G(['#fbe9e6']), G(['#f4c7c3']), G(['#fbe9e6', '#f4c7c3']), 'photo'),
  garden: K('garden', '#12301d', '#f1e6cf', G(['#a3123d'], false), G(['#2f9a45', '#38c0c8']), G(['#2f9a45', '#e8e24a', '#38c0c8'])),
  lovepop: K('lovepop', '#3a1a7a', '#fff4f4', G(['#6bbfe0', '#ff3b4f']), G(['#ff3b4f', '#ff8aa8']), G(['#ff8aa8', '#c02aa0', '#fff4f4']), 'photo'),
  olive: B('olive', '#efe9a0', ['#3a4128'], { bg: ['#1b2015', '#3d4a28', '#8c9a4e'], mid: ['#2a3320', '#8a9a45', '#e5df72'], fg: ['#2a3320', '#b9bd5a', '#f3eca0'] }),
  earth: B('earth', '#f3e8d3', ['#b79458'], { bg: ['#4a2a18', '#8c5a35', '#d9b98a'], mid: ['#3a2214', '#a4743f', '#e9d2a4'], fg: ['#2a1810', '#7a4e2e', '#f0e2c4'] }),
  field: K('field', '#14201a', '#e9eed8', G(['#7ba35a'], false), G(['#8fb26a', '#c9a35a']), G(['#d9d08a', '#7ba35a'])),
  stripes: B('stripes', '#f6efe0', ['#c98f7a', '#e2b9a1'], { bg: ['#4b2a22', '#a56a52', '#f0d9c0'], mid: ['#5b3228', '#c58a6e', '#f4dfc6'], fg: ['#3a1f1c', '#9a5a48', '#f7ead6'] }),
  maroon: B('maroon', '#e9d9b8', ['#4a1a30'], { bg: ['#2a0e1c', '#5a1f3a', '#a85a5a'], mid: ['#2a0e1c', '#7a2a3a', '#d8b24a'], fg: ['#2a0e1c', '#a8762a', '#f0d890'] }),
  boombox: K('boombox', '#16264a', '#f4efe0', G(['#e0776a'], false), G(['#5fc0a8', '#3aa0a0']), G(['#f4efe0', '#e8c46a', '#5fc0a8'])),
  stadium: K('stadium', '#14224a', '#f7efe6', G(['#5ab6e8'], false), G(['#e5707a', '#2a4a8a']), G(['#e5707a', '#f4e0d0', '#14224a'])),
  lavender: K('lavender', '#14101c', '#efe6f6', G(['#c8b4e8'], false), G(['#c8b4e8', '#f6b79a']), G(['#f6b79a', '#b8142a', '#5fb8c8'])),
  skygreen: K('skygreen', '#3a2a18', '#e8f4f6', G(['#7ec8e3'], false), G(['#5aa85a', '#d9b44a']), G(['#5aa85a', '#e8c9a0', '#9a5a2a'])),
  bluepeach: K('bluepeach', '#2b5fc4', '#f6cdb8', G(['#f6cdb8']), G(['#f6cdb8', '#e8a58c']), G(['#f6cdb8']), 'photo'),
  kraft: K('kraft', '#1c2230', '#b99a5e', G(['#b99a5e'], false), G(['#c9ad74']), G(['#f1e6c8', '#c9ad74'])),
  palm: B('palm', '#fbe3e0', ['#e84a6e'], { bg: ['#e84a6e', '#f06a7e', '#f8a07a'], mid: ['#d83a60', '#f06a7e', '#fbd0d4'], fg: ['#e8506c', '#f8a0b0', '#fff0f0'] }),
  typewriter: K('typewriter', '#7a2a80', '#f4f0ea', G(['#f4f0ea'], false), G(['#cfa8d2']), G(['#f4f0ea', '#cfa8d2'])),
  sunhill: K('sunhill', '#5a3418', '#d9f0f0', G(['#3bb5c4'], false), G(['#9a6a38', '#e8d34a']), G(['#e8d34a', '#c9a0d8', '#fff0c8'])),
  cyan: B('cyan', '#f4f8f8', ['#1d6fa5'], { bg: ['#06203a', '#1d6fa5', '#b9e0f0'], mid: ['#06203a', '#2a86c0', '#d6eef8'], fg: ['#04182c', '#1d6fa5', '#f2fafc'] }),
  royal: K('royal', '#2a1030', '#fbe8f1', G(['#e0188a'], false), G(['#f8b8d8', '#7aa8e0']), G(['#fbe8f1', '#f8d0e0', '#e8c04a']), 'flat', { lines: { color: '#2a1030', width: 28, offset: 0 } }),
  tealpink: K('tealpink', '#0a3a48', '#f4efe6', G(['#0e8fa0'], false), G(['#f2459b', '#8ad0b4']), G(['#f2459b', '#8ad0b4', '#f6e6d6', '#ff7a3a']), 'flat', { lines: { color: '#ff7a3a', width: 24, offset: 18 } }),
});
// ---- v0.7 palettes for etching / silver-gelatin looks ----
Object.assign(PRESETS, {
  etching: K('etching', '#2a2018', '#efe5cf', G(['#efe5cf']), G(['#efe5cf']), G(['#efe5cf']), 'photo'),
  etchblue: K('etchblue', '#1d2a46', '#eceee6', G(['#eceee6']), G(['#eceee6']), G(['#eceee6']), 'photo'),
  sanguine: K('sanguine', '#7b2b1b', '#f1e2cc', G(['#f1e2cc']), G(['#f1e2cc']), G(['#f1e2cc']), 'photo'),
  silver: B('silver', '#f3f1ec', ['#8a8a8c'], { bg: ['#0c0c0e', '#6f6f72', '#e4e4e2'], mid: ['#0a0a0c', '#7a7a7d', '#ecebe8'], fg: ['#08080a', '#808083', '#f6f5f1'] }),
  sepia: B('sepia', '#f1e6d0', ['#8a6a48'], { bg: ['#1a110a', '#7a5a3c', '#e6d2b0'], mid: ['#180f08', '#84623f', '#eddcbc'], fg: ['#160d07', '#8c6a46', '#f4e7cc'] }),
  selenium: B('selenium', '#eef0f2', ['#6a7078'], { bg: ['#0b0e14', '#5d6672', '#dfe4ea'], mid: ['#090c12', '#667080', '#e6eaef'], fg: ['#070a10', '#6e7888', '#f1f4f7'] }),
});
export const STYLE_ORDER = ['pop', 'sleeve', 'riso', 'duo', 'mono', 'unite', 'garden', 'lovepop', 'olive', 'earth', 'field', 'stripes', 'maroon', 'boombox', 'stadium', 'lavender', 'skygreen', 'bluepeach', 'kraft', 'palm', 'typewriter', 'sunhill', 'cyan', 'royal', 'tealpink', 'etching', 'etchblue', 'sanguine', 'silver', 'sepia', 'selenium'];
/** Resolves the active preset: built-in id, or the user's randomised palette (params.customPreset). */
export const getPreset = (p) => (p.preset === 'random' && p.customPreset ? p.customPreset : PRESETS[p.preset] || PRESETS.natural);
export const GROUP_KEYS = ['bg', 'mid', 'fg'];

/** Assign palette colours to regions (ids) by area-weighted luminance rank ("luma") or nearest Lab colour. */
export function mapRegionsToPalette(ids, st, palette, how = 'luma') {
  const out = new Map(); if (!ids.length || !palette.length) return out;
  const pal = palette.map((h) => { const rgb = hexToRgb(h); return { h, l: luma(...rgb), lab: rgbToLab(...rgb) }; }).sort((a, b) => a.l - b.l);
  if (pal.length === 1) { for (const r of ids) out.set(r, pal[0].h); return out; }
  if (how === 'nearest') {
    for (const r of ids) { let best = pal[0], bd = Infinity; for (const c of pal) { const d = Math.hypot(st.lab[r * 3] - c.lab[0], st.lab[r * 3 + 1] - c.lab[1], st.lab[r * 3 + 2] - c.lab[2]); if (d < bd) { bd = d; best = c; } } out.set(r, best.h); }
    return out;
  }
  const order = [...ids].sort((a, b) => st.lab[a * 3] - st.lab[b * 3]);
  let total = 0; for (const r of order) total += st.area[r];
  let acc = 0;
  for (const r of order) { const mid = (acc + st.area[r] / 2) / total; acc += st.area[r]; out.set(r, pal[Math.min(pal.length - 1, Math.floor(mid * pal.length))].h); }
  return out;
}
export const allPresetColors = (pr) => (pr.groups ? GROUP_KEYS.flatMap((g) => pr.groups[g].block) : []);
