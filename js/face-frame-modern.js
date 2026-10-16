// face-frame-modern.js - runs INSIDE engine/modern-frame.html (its own window / globals). Protocol (postMessage, same origin only):
//   frame -> parent : { type: 'ready' } when the page is loaded
//   parent -> frame : { type: 'detect', id, bitmap: ImageBitmap }   (bitmap is transferred)
//   frame -> parent : { type: 'result', id, faces: [[{x,y,z}...]...] } | { type: 'error', id, reason: 'model-missing' | 'files-missing' | <message> }
// Classic script on purpose (no ES module / MIME-type dependence). The Face Landmarker is created lazily on the first detect.
(() => {
  const here = (p) => new URL(p, document.baseURI).href, WASM = here('../vendor/mediapipe/tasks-vision/wasm'), MODEL = here('../vendor/mediapipe/face_landmarker/face_landmarker.task');
  let lm = null, loading = null;
  async function init() {
    if (lm) return lm; if (loading) return loading;
    loading = (async () => {
      if (typeof Vision === 'undefined' || !Vision.FaceLandmarker) { const e = new Error('files-missing'); e.code = 'files-missing'; throw e; }
      const head = await fetch(MODEL, { method: 'GET', cache: 'force-cache' }); if (!head.ok) { const e = new Error('model-missing'); e.code = 'model-missing'; throw e; }
      const model = new Uint8Array(await head.arrayBuffer()); // the model bytes are handed over directly (no second download)
      const fileset = await Vision.FilesetResolver.forVisionTasks(WASM);
      lm = await Vision.FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 4, minFaceDetectionConfidence: 0.4, minFacePresenceConfidence: 0.4, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false });
      return lm;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }
  addEventListener('message', async (ev) => {
    if (ev.origin !== location.origin || ev.source !== parent || !ev.data || ev.data.type !== 'detect') return;
    const { id, bitmap } = ev.data;
    try { const m = await init(), r = m.detect(bitmap); parent.postMessage({ type: 'result', id, faces: (r.faceLandmarks || []).map((f) => f.map((p) => ({ x: p.x, y: p.y, z: p.z }))) }, location.origin); }
    catch (e) { parent.postMessage({ type: 'error', id, reason: e && e.code ? e.code : String((e && e.message) || e) }, location.origin); }
    finally { try { bitmap.close(); } catch { /* ignore */ } }
  });
  parent.postMessage({ type: 'ready' }, location.origin);
})();
