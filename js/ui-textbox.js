// ui-textbox.js - on-preview handles for the text slots: drag to move, corner handle to scale, top handle to rotate (+-90 deg).
// The boxes live inside #zoom-layer, so they follow pinch-zoom / pan; handle sizes are counter-scaled with --z.
import { state, saveSettings } from './state.js';
import { TEXT_SLOTS, tkey } from './config.js';
import { textBox } from './style-text.js';
import { rebuildText } from './ui-extras.js';
const $ = (id) => document.getElementById(id);
export function initTextHandles({ onChange }) {
  const layer = $('zoom-layer'), box = document.createElement('div'); box.id = 'text-overlay'; box.setAttribute('aria-hidden', 'true'); layer.append(box);
  const els = []; let dragging = false;
  const place = (el, b, W, H) => { el.style.left = (b.cx / W) * 100 + '%'; el.style.top = (b.cy / H) * 100 + '%'; el.style.width = (b.w / W) * 100 + '%'; el.style.height = (b.h / H) * 100 + '%'; el.style.transform = `translate(-50%,-50%) rotate(${b.angle}deg)`; };
  function update() {
    if (dragging) return; const sc = state.scene; box.replaceChildren(); els.length = 0; if (!sc) return;
    for (let i = 0; i < TEXT_SLOTS; i++) {
      if (!state.params[tkey('textShow', i)]) continue; const b = textBox(state.params, i, sc.w, sc.h); if (!b) continue;
      const el = document.createElement('div'); el.className = 'tb' + (i === state.textSlot ? ' active' : ''); el.dataset.slot = String(i); place(el, b, sc.w, sc.h);
      const tag = document.createElement('span'); tag.className = 'tb-tag'; tag.textContent = String(i + 1);
      const rot = document.createElement('i'); rot.className = 'tb-h tb-rot'; rot.title = '↻'; const scl = document.createElement('i'); scl.className = 'tb-h tb-sc'; scl.title = '⤡';
      el.append(tag, rot, scl); box.append(el); els.push(el);
      bind(el, rot, scl, i);
    }
  }
  function bind(el, rot, scl, i) {
    const K = (k) => tkey(k, i), P = state.params;
    const frame = () => { const sc = state.scene, b = textBox(P, i, sc.w, sc.h); if (b) place(el, b, sc.w, sc.h); onChange(K('textX')); };
    const start = (target, fn) => target.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return; e.stopPropagation(); e.preventDefault(); target.setPointerCapture(e.pointerId); dragging = true;
      if (state.textSlot !== i) { state.textSlot = i; box.querySelectorAll('.tb').forEach((x) => x.classList.toggle('active', x === el)); }
      const r = layer.getBoundingClientRect(), s0 = { x: P[K('textX')], y: P[K('textY')], size: P[K('textSize')], ang: P[K('textAngle')], px: e.clientX, py: e.clientY };
      const ctr = [r.left + (P[K('textX')] / 100) * r.width, r.top + (P[K('textY')] / 100) * r.height], d0 = Math.hypot(e.clientX - ctr[0], e.clientY - ctr[1]) || 1;
      const mv = (ev) => { fn(ev, { r, s0, ctr, d0 }); frame(); };
      const up = () => { target.removeEventListener('pointermove', mv); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); saveSettings(); dragging = false; rebuildText(); update(); };
      target.addEventListener('pointermove', mv); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
    });
    start(el, (ev, c) => { P[K('textX')] = Math.max(0, Math.min(100, Math.round((c.s0.x + ((ev.clientX - c.s0.px) / c.r.width) * 100) * 10) / 10)); P[K('textY')] = Math.max(0, Math.min(100, Math.round((c.s0.y + ((ev.clientY - c.s0.py) / c.r.height) * 100) * 10) / 10)); });
    start(rot, (ev, c) => { let a = (Math.atan2(ev.clientY - c.ctr[1], ev.clientX - c.ctr[0]) * 180) / Math.PI + 90; if (a > 180) a -= 360; if (a < -180) a += 360; a = Math.max(-90, Math.min(90, a)); if (Math.abs(a) < 4) a = 0; P[K('textAngle')] = Math.round(a); });
    start(scl, (ev, c) => { const d = Math.hypot(ev.clientX - c.ctr[0], ev.clientY - c.ctr[1]); P[K('textSize')] = Math.max(4, Math.min(60, Math.round(c.s0.size * (d / c.d0) * 10) / 10)); });
  }
  return { update };
}
