// ui-stage.js - the preview frame itself: resize with the corner handle, move it anywhere (picture-in-picture style)
// with the grip; "dock" puts it back in the page flow. While floating, a placeholder keeps the page layout steady.
const $ = (id) => document.getElementById(id);
export function initStageFrame() {
  const stage = $('stage'), grip = $('stage-grip'), dock = $('stage-dock'), handle = $('stage-resize');
  let ph = null;
  const vw = () => document.documentElement.clientWidth, vh = () => window.innerHeight;
  const place = (l, t, w) => {
    const maxW = vw() - 8, W = Math.max(140, Math.min(maxW, w)), H = stage.getBoundingClientRect().height || W * 0.75;
    stage.style.width = W + 'px'; stage.style.left = Math.max(4, Math.min(vw() - W - 4, l)) + 'px'; stage.style.top = Math.max(4, Math.min(vh() - 60, t)) + 'px';
    return H;
  };
  const float = () => {
    if (stage.classList.contains('float')) return;
    const r = stage.getBoundingClientRect(); ph = document.createElement('div'); ph.id = 'stage-ph'; ph.style.height = r.height + 'px'; stage.before(ph);
    stage.classList.add('float'); place(r.left, r.top, r.width); dock.hidden = false;
  };
  const undock = () => { stage.classList.remove('float'); stage.style.width = stage.style.left = stage.style.top = ''; if (ph) ph.remove(); ph = null; dock.hidden = true; };
  dock.addEventListener('click', undock);
  const drag = (el, onMove, begin) => el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || stage.classList.contains('full')) return; e.preventDefault(); e.stopPropagation(); float(); el.setPointerCapture(e.pointerId);
    const r = stage.getBoundingClientRect(), s0 = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width };
    const mv = (ev) => onMove(ev, s0), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  drag(grip, (ev, s) => place(s.l + ev.clientX - s.x, s.t + ev.clientY - s.y, s.w));
  drag(handle, (ev, s) => place(s.l, s.t, s.w + (ev.clientX - s.x) + (ev.clientY - s.y) * 0.5));
  window.addEventListener('resize', () => { if (stage.classList.contains('float')) { const r = stage.getBoundingClientRect(); place(r.left, r.top, r.width); } });
  return { undock, isFloating: () => stage.classList.contains('float') };
}
