// face-engine-modern.js - adapter for the MODERN MediaPipe Face Landmarker (npm @mediapipe/tasks-vision 1.1.1, Tasks API).
// Runtime (JS + WASM SIMD) is bundled in vendor/mediapipe/tasks-vision. The MODEL FILE (face_landmarker.task) is NOT bundled by this build: install it with
// `node tools/fetch-face-landmarker.mjs` (downloads from Google's official storage and prints its SHA-256). Until it is present this engine reports
// { ok: false, reason: 'model-missing' } and the app says so - it never falls back to the other engine on its own.
// Nothing is fetched from a CDN at run time: both runtime and model are same-origin files, so inference is local and works offline once cached.
const RT = 'vendor/mediapipe/tasks-vision/', MODEL = 'vendor/mediapipe/face_landmarker/face_landmarker.task';
let lm = null, loading = null;
const exists = async (url) => { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch { return false; } };
async function init() {
  if (lm) return lm; if (loading) return loading;
  loading = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('../' + RT + 'vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(RT + 'wasm');
    lm = await FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 4, minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
    return lm;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
export const modernEngine = {
  id: 'modern',
  async available() {
    if (typeof WebAssembly !== 'object') return { ok: false, reason: 'no-wasm' };
    if (!(await exists(RT + 'vision_bundle.mjs'))) return { ok: false, reason: 'files-missing' };
    if (!(await exists(MODEL))) return { ok: false, reason: 'model-missing' };
    return { ok: true };
  },
  async detect(canvas, { timeoutMs = 25000 } = {}) {
    const m = await init();
    return await Promise.race([Promise.resolve().then(() => m.detect(canvas).faceLandmarks || []), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeoutMs))]);
  },
};
