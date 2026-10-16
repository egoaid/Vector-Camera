// face-engine-modern.js - adapter for the MODERN MediaPipe Face Landmarker (npm @mediapipe/tasks-vision 1.1.1, Tasks API).
// It runs inside a hidden same-origin iframe (engine/modern-frame.html) so that its WASM runtime has its own global scope: the legacy Face Mesh runtime leaves a
// global `Module` behind that breaks the Tasks Vision loader when both run in one window (root cause of "Module.noExitRuntime has been replaced ...").
// Everything is bundled in the project (vendor/mediapipe/tasks-vision runtime, vendor/mediapipe/face_landmarker/face_landmarker.task); nothing is downloaded from
// a CDN and users install nothing. All URLs are relative, so a sub-path such as /Vector-Camera/ works.
const FRAME = 'engine/modern-frame.html', MODEL = 'vendor/mediapipe/face_landmarker/face_landmarker.task', RT = 'vendor/mediapipe/tasks-vision/vision_bundle.js';
let frame = null, ready = null, seq = 0; const waiting = new Map();
// GET (not HEAD): the service worker only caches GET, so a HEAD check would fail offline. The body is not read (cancelled), the response still gets cached.
const exists = async (url) => { try { const r = await fetch(url); if (r.body) r.body.cancel().catch(() => {}); return r.ok; } catch { return false; } };
function onMessage(ev) {
  if (!frame || ev.origin !== location.origin || ev.source !== frame.contentWindow || !ev.data) return;
  const d = ev.data, w = waiting.get(d.id); if (!w) return; waiting.delete(d.id);
  if (d.type === 'result') w.ok(d.faces); else w.no(Object.assign(new Error(d.reason), { code: d.reason }));
}
function open() {
  if (ready) return ready;
  ready = new Promise((ok, no) => {
    addEventListener('message', onMessage);
    frame = document.createElement('iframe'); frame.src = FRAME; frame.title = 'Face Landmarker'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:0';
    const to = setTimeout(() => no(new Error('frame timeout')), 15000);
    const onReady = (ev) => { if (frame && ev.source === frame.contentWindow && ev.origin === location.origin && ev.data && ev.data.type === 'ready') { clearTimeout(to); removeEventListener('message', onReady); ok(); } };
    addEventListener('message', onReady); document.body.append(frame);
  });
  ready.catch(() => { if (frame) frame.remove(); frame = null; ready = null; });
  return ready;
}
export const modernEngine = {
  id: 'modern',
  async available() {
    if (typeof WebAssembly !== 'object') return { ok: false, reason: 'no-wasm' };
    if (!(await exists(FRAME)) || !(await exists(RT))) return { ok: false, reason: 'files-missing' };
    if (!(await exists(MODEL))) return { ok: false, reason: 'model-missing' };
    return { ok: true };
  },
  async detect(canvas, { timeoutMs = 25000 } = {}) {
    await open();
    const bitmap = await createImageBitmap(canvas), id = ++seq;
    return await new Promise((ok, no) => {
      const to = setTimeout(() => { waiting.delete(id); no(new Error('timeout')); }, timeoutMs);
      waiting.set(id, { ok: (v) => { clearTimeout(to); ok(v); }, no: (e) => { clearTimeout(to); no(e); } });
      frame.contentWindow.postMessage({ type: 'detect', id, bitmap }, location.origin, [bitmap]);
    });
  },
};
