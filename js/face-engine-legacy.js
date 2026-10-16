// face-engine-legacy.js - adapter for the LEGACY MediaPipe Face Mesh "solution" (npm @mediapipe/face_mesh 0.4.1633559619, bundled in vendor/mediapipe/face_mesh).
// Self-contained: the detector and landmark models are inside face_mesh_solution_packed_assets.data, so it works fully offline with no separate model file.
// Provenance / licence: vendor/mediapipe/NOTICE.txt. Runs in the browser (WASM SIMD); the image never leaves the device.
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
export const legacyEngine = {
  id: 'legacy',
  /** { ok, reason } - cheap check (no model load): the bundle file must exist and WebAssembly must be present. */
  async available() {
    if (typeof WebAssembly !== 'object') return { ok: false, reason: 'no-wasm' };
    try { const r = await fetch(BASE + 'face_mesh.js'); if (r.body) r.body.cancel().catch(() => {}); return r.ok ? { ok: true } : { ok: false, reason: 'files-missing' }; } catch { return { ok: false, reason: 'files-missing' }; } // GET, not HEAD: the service worker only caches GET, so HEAD would fail offline
  },
  /** raw faces: array of arrays of {x,y,z} (0..1) */
  async detect(canvas, { timeoutMs = 25000 } = {}) {
    const m = await init();
    const r = await new Promise((resolve, reject) => { const to = setTimeout(() => { pending = null; reject(new Error('timeout')); }, timeoutMs); pending = (v) => { clearTimeout(to); resolve(v); }; m.send({ image: canvas }).catch((e) => { clearTimeout(to); pending = null; reject(e); }); });
    return r.multiFaceLandmarks || [];
  },
};
