// pipeline-worker.js - runs the segmentation/vectorisation pipeline off the main thread (module worker).
import { Pipeline } from './pipeline-core.js';
import { traceLabels } from './vec-ink.js';
const pl = new Pipeline();
self.onmessage = (ev) => {
  const m = ev.data;
  try {
    if (m.type === 'image') { pl.setImage(m.w, m.h, new Uint8ClampedArray(m.buffer)); self.postMessage({ type: 'ready', id: m.id }); }
    else if (m.type === 'semantic') { if (m.sem) pl.setSemantic({ labels: new Uint8Array(m.sem.buffer), names: m.sem.names, C: m.sem.C }); else pl.clearSemantic(); self.postMessage({ type: 'ready', id: m.id }); }
    else if (m.type === 'process') {
      const res = pl.process(m.params, (stage, f) => self.postMessage({ type: 'progress', id: m.id, stage, f }));
      const tr = [res.labels.buffer, ...res.geom.chains.flatMap((c) => [c.cmds.buffer, c.pts.buffer])];
      self.postMessage({ type: 'result', id: m.id, res }, tr);
    }
    else if (m.type === 'trace') {
      const geom = traceLabels(new Int32Array(m.buffer), m.w, m.h, m.R, m.shape);
      self.postMessage({ type: 'result', id: m.id, res: geom }, geom.chains.flatMap((c) => [c.cmds.buffer, c.pts.buffer]));
    }
  } catch (e) { self.postMessage({ type: 'error', id: m.id, message: String(e && e.message || e) }); }
};
