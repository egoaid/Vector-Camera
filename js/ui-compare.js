// ui-compare.js - original / result comparison slider.
// Dragging works anywhere on the stage (pointer events: mouse, touch, pen). The hidden <input type=range>
// stays for keyboard / screen-reader operation (arrow keys) and mirrors the same value.
const $ = (id) => document.getElementById(id);
export function initCompare() {
  const btn = $('btn-compare'), range = $('compare-range'), orig = $('cv-original'), handle = $('compare-handle'), stage = $('stage');
  let on = false, dragging = false;
  const apply = () => { const v = +range.value; orig.style.clipPath = `inset(0 ${100 - v}% 0 0)`; handle.style.left = v + '%'; range.setAttribute('aria-valuetext', v + '%'); };
  const setFromX = (x) => { const r = stage.getBoundingClientRect(); range.value = String(Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100))); apply(); };
  const setOn = (v) => { on = v; btn.setAttribute('aria-pressed', String(v)); orig.style.display = v ? 'block' : 'none'; handle.hidden = range.hidden = !v; stage.classList.toggle('comparing', v); if (v) apply(); };
  btn.addEventListener('click', () => setOn(!on));
  range.addEventListener('input', apply);
  stage.addEventListener('pointerdown', (e) => { if (!on || e.button > 0) return; dragging = true; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); setFromX(e.clientX); e.preventDefault(); });
  stage.addEventListener('pointermove', (e) => { if (dragging) setFromX(e.clientX); });
  const end = (e) => { if (!dragging) return; dragging = false; try { stage.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } suppress = true; setTimeout(() => { suppress = false; }, 0); };
  let suppress = false;
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  setOn(false);
  return { isOn: () => on, off: () => setOn(false), swallowClick: () => on || suppress };
}
