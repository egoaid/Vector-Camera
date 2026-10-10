// pipeline-client.js - promise API over the pipeline worker, with a main-thread fallback and cancel (= terminate).
export class PipelineClient {
  constructor(onProgress = () => {}) { this.onProgress = onProgress; this.seq = 0; this.pending = new Map(); this.mode = 'worker'; this._spawn(); }
  _spawn() {
    this.worker = null; this.local = null;
    try {
      this.worker = new Worker(new URL('./pipeline-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._msg(e.data);
      this.worker.onerror = () => { this._fallback(); };
    } catch { this._fallback(); }
  }
  async _fallback() {
    if (this.local) return; this.mode = 'main';
    const { Pipeline } = await import('./pipeline-core.js'); this.local = new Pipeline(); this.worker = null;
    for (const [, p] of this.pending) p.reject(new Error('worker-failed'));
    this.pending.clear();
  }
  _msg(m) {
    if (m.type === 'progress') return this.onProgress(m.stage, m.f);
    const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
    if (m.type === 'error') p.reject(new Error(m.message)); else p.resolve(m.res || true);
  }
  _call(msg, transfer = []) {
    if (this.worker) return new Promise((resolve, reject) => { const id = ++this.seq; this.pending.set(id, { resolve, reject }); this.worker.postMessage({ ...msg, id }, transfer); });
    return null;
  }
  async setImage(w, h, rgba) {
    const copy = rgba.slice();
    if (this.worker) { try { return await this._call({ type: 'image', w, h, buffer: copy.buffer }, [copy.buffer]); } catch (e) { if (!this.local) throw e; } }
    if (!this.local) await this._fallback(); this.local.setImage(w, h, rgba.slice());
  }
  async setSemantic(sem) {
    if (this.worker) return this._call({ type: 'semantic', sem: sem ? { buffer: sem.labels.slice().buffer, names: sem.names, C: sem.C } : null });
    sem ? this.local.setSemantic(sem) : this.local.clearSemantic();
  }
  async process(params) {
    if (this.worker) return this._call({ type: 'process', params });
    await new Promise((r) => setTimeout(r, 20)); return this.local.process(params, this.onProgress);
  }
  /** Hard cancel: kill the worker (frees all memory). Caller must call setImage again before the next process(). */
  cancel() { if (this.worker) { this.worker.terminate(); for (const [, p] of this.pending) p.reject(new Error('cancelled')); this.pending.clear(); this._spawn(); } }
  dispose() { if (this.worker) this.worker.terminate(); this.worker = null; this.local = null; }
}
