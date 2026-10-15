// face-landmarks.js - optional face landmark detection with the bundled MediaPipe Face Mesh (Apache-2.0, see vendor/mediapipe/NOTICE.txt).
// Runs in the browser (WASM); the image never leaves the device. Everything degrades gracefully: when the bundle is missing,
// unsupported (no WASM SIMD) or finds no face, detectFaces() resolves to [] and the app uses its own analysis only.
const BASE = 'vendor/mediapipe/face_mesh/';
let mesh = null, loading = null, pending = null;
const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ok; s.onerror = () => no(new Error('load ' + src)); document.head.append(s); });
async function init() {
  if (mesh) return mesh; if (loading) return loading;
  loading = (async () => {
    if (typeof WebAssembly !== 'object') throw new Error('no wasm');
    if (!window.FaceMesh) await loadScript(BASE + 'face_mesh.js');
    const m = new window.FaceMesh({ locateFile: (f) => BASE + f });
    m.setOptions({ maxNumFaces: 4, refineLandmarks: true, minDetectionConfidence: 0.4, minTrackingConfidence: 0.4, selfieMode: false });
    m.onResults((r) => { if (pending) { const p = pending; pending = null; p(r); } });
    await m.initialize(); mesh = m; return m;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
/** Resolves to a list of faces; each face is an array of 478 {x, y} in 0..1 image coordinates (empty list = none / unavailable). */
export async function detectFaces(canvas, { timeoutMs = 25000 } = {}) {
  try {
    const m = await init();
    const r = await new Promise((resolve, reject) => { const to = setTimeout(() => { pending = null; reject(new Error('timeout')); }, timeoutMs); pending = (v) => { clearTimeout(to); resolve(v); }; m.send({ image: canvas }).catch((e) => { clearTimeout(to); pending = null; reject(e); }); });
    return (r.multiFaceLandmarks || []).map((f) => f.map((p) => ({ x: p.x, y: p.y })));
  } catch (e) { console.warn('face landmarks unavailable', e && e.message); return []; }
}
