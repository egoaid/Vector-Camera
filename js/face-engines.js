// face-engines.js - engine registry, the NORMALISED landmark representation and its validation (pure code, no DOM).
//
// NORMALISED REPRESENTATION ("mp478"): one face = Array(478) of { x, y, z } in 0..1 image coordinates (x right, y down, z = relative depth, may be 0),
// indices follow the canonical MediaPipe face mesh (0..467 mesh, 468..477 iris: 468 = one iris centre + 469..472 its ring, 473 = the other + 474..477).
// Both supported engines emit this topology (legacy Face Mesh with refineLandmarks, and the Face Landmarker task). Everything downstream
// (scene-kinds.js) reads ONLY this representation, so an engine can be swapped without touching the artistic code.
// Nothing here switches engines: the caller passes the engine id the person selected.
export const ENGINE_IDS = ['legacy', 'modern'];
export const LANDMARK_COUNT = 478, MESH_COUNT = 468;
/** Landmark indices the app depends on (scene-kinds.js). The mapping check proves every one exists in a face. */
export const MAPPING_USED = [10, 152, 33, 133, 263, 362, 4, 13, 14, 61, 291, 205, 425, 468, 473];

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Converts whatever an engine returned into the canonical 478-point form, or null when it cannot be (wrong length / non-finite). 468-point meshes get estimated iris points (flagged by face.irisEstimated). */
export function normalizeFace(raw) {
  if (!Array.isArray(raw) || (raw.length !== MESH_COUNT && raw.length !== LANDMARK_COUNT)) return null;
  const f = raw.map((p) => ({ x: +p.x, y: +p.y, z: Number.isFinite(+p.z) ? +p.z : 0 }));
  if (f.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  if (f.length === MESH_COUNT) { // estimated iris: centre of the eye contour, ring radius = 12% of the eye width
    const ring = (c, ids, w) => { const cx = ids.reduce((s, i) => s + f[i].x, 0) / ids.length, cy = ids.reduce((s, i) => s + f[i].y, 0) / ids.length, r = w * 0.12; return [{ x: cx, y: cy, z: 0 }, { x: cx + r, y: cy, z: 0 }, { x: cx, y: cy - r, z: 0 }, { x: cx - r, y: cy, z: 0 }, { x: cx, y: cy + r, z: 0 }]; };
    const R = [33, 160, 158, 133, 153, 144], L = [362, 385, 387, 263, 373, 380];
    f.push(...ring(0, R, dist(f[33], f[133])), ...ring(1, L, dist(f[362], f[263])));
    f.irisEstimated = true;
  }
  return f;
}
/**
 * Plausibility check of a normalised face. Rotation-invariant (portrait / landscape / upside-down faces pass); returns { ok, reasons[] }.
 * It cannot prove a face is *correct*, only reject geometry that is impossible for a face (corrupt output, wrong index mapping, mirrored topology).
 */
export function validateFace(face) {
  const why = [];
  if (!Array.isArray(face) || face.length !== LANDMARK_COUNT) return { ok: false, reasons: ['length'] };
  for (const i of MAPPING_USED) if (!face[i]) why.push('index ' + i);
  if (why.length) return { ok: false, reasons: why };
  if (face.some((p) => !(p.x > -0.5 && p.x < 1.5 && p.y > -0.5 && p.y < 1.5))) why.push('outside the image');
  const eyeR = mid(face[33], face[133]), eyeL = mid(face[362], face[263]), eyes = mid(eyeR, eyeL), mouth = mid(face[13], face[14]), io = dist(eyeR, eyeL);
  if (!(io > 1e-4)) return { ok: false, reasons: ['eyes coincide'] };
  const axX = mouth.x - eyes.x, axY = mouth.y - eyes.y, axL = Math.hypot(axX, axY);
  if (!(axL > io * 0.6 && axL < io * 2.6)) why.push('eye-mouth distance ' + (axL / io).toFixed(2) + 'x interocular');
  const t = ((face[4].x - eyes.x) * axX + (face[4].y - eyes.y) * axY) / (axL * axL || 1);
  if (!(t > 0.2 && t < 0.9)) why.push('nose not between eyes and mouth (t=' + t.toFixed(2) + ')');
  const ew = (dist(face[33], face[133]) + dist(face[362], face[263])) / 2;
  if (!(ew > io * 0.2 && ew < io * 0.75)) why.push('eye width ' + (ew / io).toFixed(2) + 'x interocular');
  if (!(dist(face[152], eyes) > dist(face[10], eyes))) why.push('chin nearer the eyes than the forehead');
  // left/right topology: the right-eye contour (33) and the left-eye contour (263) must be on opposite sides of the nose axis; mirrored meshes swap them but stay valid,
  // so this only guards against both on the same side
  const side = (p) => (p.x - eyes.x) * axY - (p.y - eyes.y) * axX; if (side(face[33]) * side(face[263]) >= 0) why.push('eyes on the same side of the face axis');
  return { ok: why.length === 0, reasons: why };
}
/** Mean displacement between two engines' landmarks for the same face, as a fraction of the interocular distance (a comparison number, not an accuracy score). */
export function meanDisplacement(a, b) {
  const eyes = (f) => dist(mid(f[33], f[133]), mid(f[362], f[263])), io = (eyes(a) + eyes(b)) / 2; let s = 0;
  for (let i = 0; i < MESH_COUNT; i++) s += dist(a[i], b[i]); return s / MESH_COUNT / io;
}
/** Pairs faces of two engines by nearest face-box centre. Returns [[iA, iB], ...]. */
export function pairFaces(A, B) {
  const c = (f) => { let x = 0, y = 0; for (let i = 0; i < MESH_COUNT; i++) { x += f[i].x; y += f[i].y; } return { x: x / MESH_COUNT, y: y / MESH_COUNT }; };
  const used = new Set(), out = [];
  A.forEach((fa, i) => { let best = -1, bd = Infinity; B.forEach((fb, j) => { if (used.has(j)) return; const d = dist(c(fa), c(fb)); if (d < bd) { bd = d; best = j; } }); if (best >= 0 && bd < 0.2) { used.add(best); out.push([i, best]); } });
  return out;
}
