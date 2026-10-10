// ui-compare.js - original / result comparison slider.
const $ = (id) => document.getElementById(id);
export function initCompare() {
  const btn = $('btn-compare'), range = $('compare-range'), orig = $('cv-original'), handle = $('compare-handle');
  const apply = () => { const v = +range.value; orig.style.clipPath = `inset(0 ${100 - v}% 0 0)`; handle.style.left = v + '%'; range.setAttribute('aria-valuetext', v + '%'); };
  const setOn = (on) => { btn.setAttribute('aria-pressed', String(on)); orig.style.display = on ? 'block' : 'none'; handle.hidden = range.hidden = !on; $('stage').classList.toggle('comparing', on); if (on) apply(); };
  btn.addEventListener('click', () => setOn(btn.getAttribute('aria-pressed') !== 'true'));
  range.addEventListener('input', apply); setOn(false);
  return { isOn: () => btn.getAttribute('aria-pressed') === 'true', off: () => setOn(false) };
}
