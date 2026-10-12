// halftone-types.js - threshold fields for the screen types: dot, line, cross-hatch and engraving.
// Every type returns s in [0,1]; ink is laid down where the darkness `d` exceeds s, so darker tones thicken lines /
// add hatch layers / swell dots. Pure math (no DOM), shared by the photo ink renderer and the text effects.
export const HT_TYPES = ['dot', 'line', 'cross', 'engrave'];
const frac = (v) => v - Math.floor(v);
const tri = (u) => Math.abs(frac(u) - 0.5) * 2; // 0 on a line centre, 1 midway between lines

/** Threshold of a halftone screen at pixel (x,y). `cell` = pitch in px, `angleRad` = screen angle. */
export function htThreshold(type, x, y, cell, angleRad) {
  const ca = Math.cos(angleRad), sa = Math.sin(angleRad), u = (x * ca + y * sa) / cell, v = (-x * sa + y * ca) / cell;
  switch (type) {
    case 'line': return tri(u);
    case 'cross': { // hatch layers that appear as the tone gets darker (like pen cross-hatching)
      const c2 = Math.cos(angleRad + Math.PI / 3), s2 = Math.sin(angleRad + Math.PI / 3), c3 = Math.cos(angleRad - Math.PI / 3), s3 = Math.sin(angleRad - Math.PI / 3);
      const u2 = (x * c2 + y * s2) / cell, u3 = (x * c3 + y * s3) / cell;
      return Math.min(tri(u), 0.32 + 0.68 * tri(u2), 0.66 + 0.34 * tri(u3));
    }
    case 'engrave': { // banknote-portrait style: gently swelling parallel lines whose width follows the tone
      const w = 0.75 * Math.sin((2 * Math.PI * v) / (cell * 14)) + 0.28 * Math.sin((2 * Math.PI * v) / (cell * 4.3) + 1.3);
      const uu = u + w, base = tri(uu);
      const cross = Math.cos(angleRad + Math.PI / 2), crossS = Math.sin(angleRad + Math.PI / 2), ux = (x * cross + y * crossS) / (cell * 1.6) + 0.5 * Math.sin((2 * Math.PI * u) / 9);
      return Math.min(base * 0.94, 0.78 + 0.22 * tri(ux)); // very dark areas get a faint cross-cut
    }
    default: return 0.5 + 0.25 * (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v));
  }
}
