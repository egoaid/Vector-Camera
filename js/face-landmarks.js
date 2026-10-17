// face-landmarks.js - face landmark detection facade. The person selects the engine (state.params.faceEngine: 'modern' | 'off'); this module runs
// exactly that engine and NEVER substitutes another one. Output is the normalised 478-point representation (face-engines.js) and every face is validated.
// Failure of an engine (missing files, no WASM, timeout, no face) yields { faces: [], status } - the app then uses its own subject analysis only.
import { normalizeFace, validateFace } from './face-engines.js';
import { modernEngine } from './face-engine-modern.js';
const adapters = { modern: modernEngine };
/** Test hook: replace an adapter (used by tests/engines.test.mjs with clearly labelled mocks). */
export const _setAdapter = (id, a) => { adapters[id] = a; };
export const engineAvailable = (id) => (adapters[id] ? adapters[id].available() : Promise.resolve({ ok: false, reason: 'unknown-engine' }));
/**
 * -> { engine, status: 'ok' | 'none' | 'off' | 'unavailable' | 'error', reason?, ms, faces: normalised[], rejected: [{reasons}] }
 * 'none' = engine ran, found no (valid) face. 'unavailable' = files / model missing or no WASM. 'error' = the engine threw / timed out.
 */
export async function detectFacesDetailed(canvas, { engine = 'modern', timeoutMs = 25000 } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), done = (o) => ({ engine, ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0), faces: [], rejected: [], ...o });
  if (engine === 'off') return done({ status: 'off' });
  const a = adapters[engine]; if (!a) return done({ status: 'unavailable', reason: 'unknown-engine' });
  try {
    const av = await a.available(); if (!av.ok) return done({ status: 'unavailable', reason: av.reason });
    const raw = await a.detect(canvas, { timeoutMs }), faces = [], rejected = [];
    for (const r of raw || []) { const f = normalizeFace(r); if (!f) { rejected.push({ reasons: ['unsupported landmark count'] }); continue; } const v = validateFace(f); if (v.ok) faces.push(f); else rejected.push({ reasons: v.reasons }); }
    return done({ status: faces.length ? 'ok' : 'none', faces, rejected });
  } catch (e) { console.warn('face engine ' + engine + ' failed', e && e.message); return done({ status: 'error', reason: String((e && e.message) || e) }); }
}
/** Legacy convenience: just the faces of the selected engine. */
export async function detectFaces(canvas, opts = {}) { return (await detectFacesDetailed(canvas, opts)).faces; }
