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
