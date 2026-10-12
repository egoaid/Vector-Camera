// seg-segformer.js - main-thread client for the optional segmentation worker.
import { AI } from './config.js';
let worker = null, seq = 0; const pending = new Map();
function ensure() {
  if (worker) return worker;
  worker = new Worker(new URL('./seg-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => { const m = e.data, p = pending.get(m.id); if (!p) return; if (m.type === 'progress') return p.onProgress && p.onProgress(m.d); pending.delete(m.id); m.type === 'error' ? p.reject(new Error(m.message)) : p.resolve(m); };
  worker.onerror = (e) => { for (const [, p] of pending) p.reject(new Error(e.message || 'seg-worker-failed')); pending.clear(); worker = null; };
  return worker;
}
export const isSupported = () => typeof Worker !== 'undefined' && typeof WebAssembly === 'object';
/** work: {w,h,data(RGBA)}. Resolves to { labels:Uint8Array, names:[], C } in working-image coordinates. */
export function runSegformer(work, onProgress) {
  const rgb = new Uint8ClampedArray(work.w * work.h * 3);
  for (let i = 0, j = 0, k = 0; i < work.w * work.h; i++, j += 4) { rgb[k++] = work.data[j]; rgb[k++] = work.data[j + 1]; rgb[k++] = work.data[j + 2]; }
  const w = ensure(), id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (m) => resolve({ labels: new Uint8Array(m.labels), names: m.names, C: m.C }), reject, onProgress });
    w.postMessage({ id, w: work.w, h: work.h, buffer: rgb.buffer, cfg: { cdn: AI.cdn(AI.transformersVersion), model: AI.model, dtype: AI.dtype } }, [rgb.buffer]);
  });
}
export function cancelAI() { if (worker) { worker.terminate(); worker = null; for (const [, p] of pending) p.reject(new Error('cancelled')); pending.clear(); } }
