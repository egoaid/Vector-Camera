// works-db.js - "Works" storage: past photos and their edit data, kept only in this browser (IndexedDB, nothing is uploaded).
// Two stores: `works` (small records: edit parameters, overrides, thumbnail) and `originals` (the original photo Blobs, key "<id>/<index>"),
// so listing the works never has to read the big photos.
const DB_NAME = 'vector-camera', DB_VERSION = 1;
export const WORKS_AVAILABLE = typeof indexedDB !== 'undefined';
let dbp = null;
function open() {
  if (!WORKS_AVAILABLE) return Promise.reject(new Error('no-idb'));
  if (!dbp) dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VERSION);
    rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('works')) db.createObjectStore('works', { keyPath: 'id' }); if (!db.objectStoreNames.contains('originals')) db.createObjectStore('originals'); };
    rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };
    rq.onerror = () => { dbp = null; rej(rq.error); };
    rq.onblocked = () => { dbp = null; rej(new Error('blocked')); };
  });
  return dbp;
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const okey = (id, i) => `${id}/${i}`;
const range = (id) => IDBKeyRange.bound(`${id}/`, `${id}/￿`);

export const newWorkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Creates (or fully replaces) a work: record + original photos. rec = { id, kind, created, updated, n, mode, params, overrides, thumb } */
export async function putWork(rec, originals) {
  const db = await open(), tx = db.transaction(['works', 'originals'], 'readwrite'), done_ = done(tx);
  tx.objectStore('works').put(rec);
  if (originals) { const os = tx.objectStore('originals'); os.delete(range(rec.id)); originals.forEach((b, i) => os.put(b, okey(rec.id, i))); }
  await done_;
}
/** Replaces the original photos of a work (collage: a photo was added). */
export async function putOriginals(id, originals) {
  const db = await open(), tx = db.transaction('originals', 'readwrite'), done_ = done(tx), os = tx.objectStore('originals');
  os.delete(range(id)); originals.forEach((b, i) => os.put(b, okey(id, i))); await done_;
}
/** Updates fields of an existing work. Returns false if it no longer exists (it was deleted meanwhile). */
export async function patchWork(id, patch) {
  const db = await open(), tx = db.transaction('works', 'readwrite'), done_ = done(tx), st = tx.objectStore('works');
  const cur = await req(st.get(id)); if (!cur) { tx.abort(); await done_.catch(() => {}); return false; }
  st.put({ ...cur, ...patch, id }); await done_; return true;
}
/** All records, newest edit first (no photo data is read). */
export async function listWorks() {
  const db = await open(), all = await req(db.transaction('works').objectStore('works').getAll());
  return all.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
/** { rec, blobs } or null. */
export async function loadWork(id) {
  const db = await open(), tx = db.transaction(['works', 'originals']), rec = await req(tx.objectStore('works').get(id)); if (!rec) return null;
  const blobs = []; for (let i = 0; i < (rec.n || 1); i++) { const b = await req(tx.objectStore('originals').get(okey(id, i))); if (!b) return null; blobs.push(b); }
  return { rec, blobs };
}
export async function removeWork(id) {
  const db = await open(), tx = db.transaction(['works', 'originals'], 'readwrite'), done_ = done(tx);
  tx.objectStore('works').delete(id); tx.objectStore('originals').delete(range(id)); await done_;
}
export async function clearWorks() {
  const db = await open(), tx = db.transaction(['works', 'originals'], 'readwrite'), done_ = done(tx);
  tx.objectStore('works').clear(); tx.objectStore('originals').clear(); await done_;
}
/** Asks the browser not to evict this data under storage pressure (best effort; ignored where unsupported). */
export async function requestPersistence() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* ignore */ } return false; }
