// ai-worker.js - optional AI route. Loads Transformers.js from a CDN on first use (nothing is bundled) and runs the
// SegFormer-B0 / ADE20K semantic segmentation model locally (WASM). The image never leaves the device.
// NOTE: this route needs network access on first use (runtime + model download) and is cached by the browser afterwards.
import { segmentsToLabelMap } from './seg-semantic.js';
let seg = null, loading = null;
async function load(cfg, report) {
  if (seg) return seg;
  if (!loading) loading = (async () => {
    const tf = await import(/* webpackIgnore: true */ cfg.cdn);
    tf.env.allowLocalModels = false; tf.env.useBrowserCache = true;
    const p = await tf.pipeline('image-segmentation', cfg.model, { dtype: cfg.dtype, device: 'wasm', progress_callback: (d) => report(d) });
    return { tf, p };
  })();
  try { seg = await loading; } catch (e) { loading = null; throw e; }
  return seg;
}
self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    const { tf, p } = await load(m.cfg, (d) => self.postMessage({ type: 'progress', id: m.id, d: { status: d.status, file: d.file, progress: d.progress, loaded: d.loaded, total: d.total } }));
    self.postMessage({ type: 'progress', id: m.id, d: { status: 'inference' } });
    const rgb = new Uint8ClampedArray(m.buffer), img = new tf.RawImage(rgb, m.w, m.h, 3);
    const segments = await p(img);
    const map = segmentsToLabelMap(segments, m.w, m.h);
    self.postMessage({ type: 'result', id: m.id, labels: map.labels.buffer, names: map.names, C: map.C }, [map.labels.buffer]);
  } catch (e) { self.postMessage({ type: 'error', id: m.id, message: String((e && e.message) || e) }); }
};
