// ui-zoom.js - preview zoom / pan: buttons, pinch (pointer events), ctrl+wheel, fit, frame height, fullscreen.
// The frame never grows with the zoom, so the parameter panel is never covered; fullscreen is view-only.
const $ = (id) => document.getElementById(id);
export function initZoom({ onSettle = () => {}, isCompare = () => false } = {}) {
  const stage = $('stage'), layer = $('zoom-layer'), MAXZ = 8, pts = new Map(), SIZES = ['s', 'm', 'l'];
  let z = 1, tx = 0, ty = 0, swallow = false, pinch = null, pan = null, moved = 0, timer = 0, pinching = false;
  const apply = () => {
    const W = layer.offsetWidth, H = layer.offsetHeight;
    z = Math.min(MAXZ, Math.max(1, z)); tx = Math.min(0, Math.max(W - W * z, tx)); ty = Math.min(0, Math.max(H - H * z, ty));
    if (z === 1) { tx = 0; ty = 0; }
    layer.style.transform = z === 1 ? '' : `translate(${tx}px,${ty}px) scale(${z})`; layer.style.setProperty('--z', String(z));
        clearTimeout(timer); timer = setTimeout(() => onSettle(z), 200);
  };
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const zoomTo = (nz, cx, cy) => { nz = Math.min(MAXZ, Math.max(1, nz)); const ux = (cx - tx) / z, uy = (cy - ty) / z; z = nz; tx = cx - ux * nz; ty = cy - uy * nz; apply(); };
  const setFull = (on) => { stage.classList.toggle('full', on); document.body.classList.toggle('noscroll', on); $('zoom-full').textContent = on ? '✕' : '⛶'; z = 1; apply(); };
  $('zoom-full').addEventListener('click', () => setFull(!stage.classList.contains('full')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('full')) setFull(false); });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), ...local(e)); }, { passive: false });
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.zoom-bar,#stage-resize') || e.button > 0) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinching = true; pan = null; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z, tx, ty, c: mid(a, b) }; }
    else if (pts.size === 1) pan = { x: e.clientX, y: e.clientY, tx, ty };
  });
  const mid = (a, b) => { const r = stage.getBoundingClientRect(); return [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top]; };
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], c = mid(a, b), nz = Math.min(MAXZ, Math.max(1, pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)));
      const ux = (pinch.c[0] - pinch.tx) / pinch.z, uy = (pinch.c[1] - pinch.ty) / pinch.z; z = nz; tx = c[0] - ux * nz; ty = c[1] - uy * nz; moved = 99; apply();
    } else if (pan && z > 1 && !isCompare()) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y; moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 6) { tx = pan.tx + dx; ty = pan.ty + dy; apply(); }
    }
  });
  const end = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (moved > 6) { swallow = true; setTimeout(() => { swallow = false; }, 0); }
    if (pts.size < 2) { pinch = null; setTimeout(() => { pinching = false; }, 60); }
    if (pts.size === 1) { const [p] = [...pts.values()]; pan = { x: p[0], y: p[1], tx, ty }; } else if (!pts.size) pan = null;
  };
  let lastType = 'mouse'; stage.addEventListener('pointerdown', (e) => { lastType = e.pointerType; }, true);
  stage.addEventListener('dblclick', (e) => { if (lastType === 'mouse' && !e.target.closest('.tb,.zoom-bar,#stage-resize')) { z = 1; apply(); } });
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  // iOS Safari: never let the page itself pinch-zoom
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && e.scale !== undefined && e.scale !== 1) e.preventDefault(); }, { passive: false });
  apply();
  return { getZoom: () => z, reset: () => { z = 1; apply(); }, swallowClick: () => swallow, pinching: () => pinching, isFull: () => stage.classList.contains('full') };
}
