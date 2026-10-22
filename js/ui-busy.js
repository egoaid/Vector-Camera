// ui-busy.js - tiny pixel-art "silkscreen printing" animation shown while a slow generation runs.
// The animation is pure CSS (transform / opacity only), so it keeps moving even while the main thread is busy drawing.
const $ = (id) => document.getElementById(id);
const HEART = ['.XX...XX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const u = (n) => `calc(var(--u) * ${n})`;

/** Box-shadow list that paints the pixel heart (the print) from a single 1-unit element. */
export function heartShadow() {
  const out = [];
  HEART.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== 'X') return;
    out.push(`${u(x)} ${u(y)} 0 0 ${x === 1 && y === 1 ? '#fff' : 'var(--accent)'}`);
  }));
  return out.join(',');
}

/** Fills an empty element with the animation: frame + paper (heart revealed by a sliding blank cover) + squeegee. */
export function buildPress(host) {
  const mk = (cls, parent = host) => { const el = document.createElement('i'); el.className = cls; parent.appendChild(el); return el; };
  host.setAttribute('aria-hidden', 'true');
  mk('vp-frame');
  const sheet = mk('vp-sheet');
  mk('vp-ink', sheet).style.boxShadow = heartShadow();
  mk('vp-cover', sheet);
  const blade = mk('vp-blade');
  mk('vp-grip', blade); mk('vp-bead', blade);
  return host;
}

export function initBusy() { for (const host of document.querySelectorAll('.vc-press')) if (!host.firstChild) buildPress(host); }

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
let depth = 0;
/** Shows / hides the small floating indicator (nested calls are counted). It fades in after a short delay, so quick jobs never flash it. */
export function setBusy(on) {
  depth = Math.max(0, depth + (on ? 1 : -1));
  const el = $('busy'); if (el) el.hidden = depth === 0;
}
/** Runs fn with the indicator up; waits one frame first so it is painted before any heavy synchronous drawing starts. */
export async function withBusy(fn) {
  setBusy(true);
  try { await frame(); return await fn(); } finally { setBusy(false); }
}
