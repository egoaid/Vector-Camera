// app.js - application bootstrap and orchestration (input -> analysis -> style -> export).
import { initLang, setLang, getLang, t, applyDom } from './i18n.js';
import { state, loadSettings, saveSettings, applyModeDefaults } from './state.js';
import { LIMITS, MODE_PRESETS, pipelineParams } from './config.js';
import { versionString } from './version.js';
import * as wake from './wake-lock.js';
import { initCameraUI } from './ui-camera.js';
import { loadSource, makeWorking } from './image-input.js';
import { PipelineClient } from './pipeline-client.js';
import { classifyGroups } from './seg-saliency.js';
import { buildScene, sceneHasRaster } from './style-scene.js';
import { buildCollageScene } from './style-collage.js';
import { vectorizeScene } from './vec-ink.js';
import { TRACE_SHAPE } from './vec-ink.js';
import { randomize, History } from './style-random.js';
import { buildExtras } from './ui-extras.js';
import { ensureFonts, missingFonts, failedFonts } from './style-text.js';
import { makeInkFactory } from './render-ink.js';
import { drawScene, releaseScene } from './render-canvas.js';
import { showScreen, showProcessing, hideProcessing, showError } from './ui-views.js';
import { buildControls, presetDefaults } from './ui-controls.js';
import { initCompare } from './ui-compare.js';
import { initZoom } from './ui-zoom.js';
import { initStageFrame } from './ui-stage.js';
import { initSheet } from './ui-sheet.js';
import { initLayout } from './ui-layout.js';
import { initTextHandles } from './ui-textbox.js';
import { initHub } from './ui-hub.js';
import { initExport, updateExportNote } from './ui-export.js';
import { initAbout } from './ui-about.js';
import { registerSW } from './pwa.js';
import { toast } from './ui-toast.js';
import { analyzeKinds } from './scene-kinds.js';
import { detectFacesDetailed } from './face-landmarks.js';
import { switchEngine, syncActiveProfile } from './face-profiles.js';
import { initAB } from './ui-engine-ab.js';
import { initStyleLibrary, buildStyleLibrary } from './ui-styles.js';
import { renderRandomLock } from './ui-extras.js';
import { PRESETS, getPreset } from './style-palette.js';

const $ = (id) => document.getElementById(id);
const STAGE_KEY = { segment: 'proc.segment', merge: 'proc.merge', regions: 'proc.regions', vectorize: 'proc.vectorize', done: 'proc.done' };
const undoH = new History(60), redoH = new History(60);
let base = null, lastT = 0;
let client, compare, zoom, handles, lastKey = '', pipeStale = false, inkCache = null, debounce = 0, editing = false, cancelled = false;

/* ---------- processing helpers ---------- */
const onPipeProgress = (stage, f) => { if (!$('processing').hidden && !state.collageBusy) showProcessing(STAGE_KEY[stage] || 'proc.segment', 0.4 + 0.55 * f); };
async function ensurePipeline() {
  if (!pipeStale) return; pipeStale = false;
  await client.setImage(state.work.w, state.work.h, state.work.data); await client.setSemantic(state.sem); lastKey = '';
}
const yieldUI = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/* ---------- replacing the photo / collage (can be cancelled without losing the current edit) ---------- */
const SESSION_KEYS = ['source', 'canvas', 'work', 'sem', 'faces', 'facesEngine', 'faceStatus', 'engineUsed', 'overrides', 'collage', 'result', 'groups', 'scene'];
let replacing = null, hub = null, camFrom = 'hub', collageAppendNext = false;
const hasEdits = () => !!(state.result && (state.collage || state.overrides.length));
const confirmReplace = () => !hasEdits() || window.confirm(t('hub.replace'));
function beginReplace() { replacing = { pipeStale, lastKey, inkCache, undo: undoH.stack.slice(), redo: redoH.stack.slice() }; for (const k of SESSION_KEYS) replacing[k] = state[k]; }
const commitReplace = () => { replacing = null; };
/** Puts back the photo / collage that was open before a failed or cancelled replacement. */
function rollbackReplace() {
  if (!replacing) return; const r = replacing; replacing = null;
  for (const k of SESSION_KEYS) state[k] = r[k];
  pipeStale = true; lastKey = ''; inkCache = r.inkCache; undoH.stack = r.undo; redoH.stack = r.redo; syncUndo();
}
const showHub = () => hub.show();
const resumeEdit = () => { if (!state.result) return; showScreen('result'); redraw(); };

/* ---------- load + analyse ---------- */
async function startWithSource(fileOrCanvas) {
  if (!confirmReplace()) { showHub(); return; }
  showProcessing('proc.prepare', 0.03); await yieldUI(); beginReplace();
  try {
    const { source, canvas } = await loadSource(fileOrCanvas);
    state.source = source; state.canvas = canvas; state.overrides = []; editing = false; state.collage = null; resetHistory();
    await analyze();
  } catch (e) { console.error(e); rollbackReplace(); hideProcessing(); showHub(); showError('start-error', t(/memory|alloc/i.test(String(e && e.message)) ? 'err.memory' : 'err.load')); }
}
async function analyze() {
  cancelled = false; const mySeq = ++state.seq;
  showProcessing('proc.prepare', 0.08); await yieldUI();
  state.work = makeWorking(state.canvas, state.params.quality);
  state.sem = null; state.engineUsed = 'classic'; state.faces = undefined; state.faceStatus = null; pipeStale = false; lastKey = '';
  await client.setImage(state.work.w, state.work.h, state.work.data); await client.setSemantic(null);
  if (cancelled || mySeq !== state.seq) return;
  showProcessing('proc.segment', 0.4);
  try { await runPipeline(true); } catch (e) { if (cancelled) return; console.error(e); rollbackReplace(); hideProcessing(); toast(t('err.generic')); if (state.result) resumeEdit(); else showHub(); return; }
  if (cancelled) return;
  commitReplace(); hideProcessing(); showScreen('result'); zoom.reset(); buildUI(); await ensureFonts(state.params); await yieldUI(); redraw(); drawOriginal();
}
async function runPipeline(force = false) {
  await ensurePipeline();
  const pp = pipelineParams(state.params, state.work.w, state.work.h), key = JSON.stringify(pp) + state.engineUsed;
  if (!force && key === lastKey && state.result) return false;
  const res = await client.process(pp); lastKey = key; state.result = res; inkCache = null; return true;
}

/* ---------- collage ---------- */
const collageQuality = () => (state.params.quality === 'high' ? 'standard' : state.params.quality);
async function processCell(cell) {
  const w = makeWorking(cell.canvas, collageQuality());
  await client.setImage(w.w, w.h, w.data); await client.setSemantic(null);
  const pp = pipelineParams(state.params, w.w, w.h); cell.res = await client.process(pp); cell.key = JSON.stringify(pp);
  cell.groups = null; cell.inkCache = null;
}
async function addCollageFiles(files, append = true) {
  const have = append && state.collage ? state.collage.cells : [];
  const list = [...files].filter((f) => f instanceof HTMLCanvasElement || /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name)).slice(0, 12 - have.length);
  if (!list.length) return;
  if (!append && !confirmReplace()) { showHub(); return; } // a new collage replaces the current edit; nothing is changed until it is built
  beginReplace(); cancelled = false; const mySeq = ++state.seq; const cells = have.slice();
  try {
    for (let i = 0; i < list.length; i++) {
      showProcessing('proc.collage', (i + 0.1) / list.length * 0.9, { n: i + 1, m: list.length }); await yieldUI();
      const { source, canvas } = await loadSource(list[i]); const cell = { source, canvas }; await processCell(cell); if (cancelled || mySeq !== state.seq) return; cells.push(cell);
    }
  } catch (e) { console.error(e); rollbackReplace(); hideProcessing(); toast(t('err.load')); if (state.result) resumeEdit(); else showHub(); return; }
  state.collage = { cells }; state.result = cells[0].res; state.source = cells[0].source; state.canvas = cells[0].canvas; state.overrides = []; editing = false; resetHistory(); commitReplace();
  hideProcessing(); showScreen('result'); zoom.reset(); buildUI(); await ensureFonts(state.params); await yieldUI(); redraw();
}
async function reprocessCollage(mySeq) {
  for (let i = 0; i < state.collage.cells.length; i++) {
    const cell = state.collage.cells[i], w = makeWorking(cell.canvas, collageQuality()), pp = pipelineParams(state.params, w.w, w.h);
    if (cell.key === JSON.stringify(pp)) continue;
    showProcessing('proc.collage', (i + 0.1) / state.collage.cells.length * 0.9, { n: i + 1, m: state.collage.cells.length });
    await processCell(cell); if (mySeq !== state.seq) return false;
  }
  hideProcessing(); return true;
}
const collageCells = (inkLongFor) => state.collage.cells.map((c) => {
  if (!c.groups) c.groups = classifyGroups(c.res.stats, c.res.w, c.res.h, { subjectSize: state.params.subjectSize / 100, semNames: null, semMajor: null, overrides: [], labels: c.res.labels });
  return { res: c.res, groups: c.groups, ink: (long) => { const L = Math.min(inkLongFor(long), Math.max(c.source.w, c.source.h)); if (!c.inkCache || c.inkCache.res !== c.res || c.inkCache.long !== L) c.inkCache = { res: c.res, long: L, f: makeInkFactory(c.source, c.res, L) }; return c.inkCache.f; } };
});

/* ---------- scene + drawing ---------- */
function computeGroups() {
  const r = state.result;
  state.groups = classifyGroups(r.stats, r.w, r.h, { subjectSize: state.params.subjectSize / 100, semNames: r.semNames, semMajor: r.semMajor, overrides: state.overrides, labels: r.labels });
  ensureKinds(r);
}
const NO_FACES = [];
function setFaceStatus(s) { state.faceStatus = s; document.dispatchEvent(new CustomEvent('vc:face-status')); }
/** What is where (skin, hair, leaves, sky, eyes ...): own analysis of the regions plus optional face landmarks. Computed only when a style uses it. */
function ensureKinds(r) {
  const p = state.params; if (state.collage || !state.work || !(p.mode === 'hybrid' && p.halftone > 0 && p.halftoneType === 'etching' && p.htKinds > 0)) return;
  const eng = p.faceEngine || 'legacy'; // the engine the person selected - never substituted by another one
  if (state.facesEngine !== eng) { state.faces = undefined; state.facesEngine = eng; state.faceStatus = null; }
  if (eng === 'off') { state.faces = NO_FACES; setFaceStatus({ engine: 'off', status: 'off', faces: 0, ms: 0 }); }
  else if (state.faces === undefined && state.canvas) { // faces are looked for once per photo and engine, in the background; the picture is redrawn when they arrive
    state.faces = null; const tok = state.work;
    detectFacesDetailed(state.canvas, { engine: eng }).then((res) => { if (state.work !== tok || (state.params.faceEngine || 'legacy') !== eng) return; state.faces = res.faces; setFaceStatus({ engine: eng, status: res.status, reason: res.reason, faces: res.faces.length, ms: res.ms }); if (state.result) { state.result.kinds = null; if (res.faces.length) redraw(); } });
  }
  if (r.kinds && r.kinds.faces_ === state.faces) return;
  const k = analyzeKinds({ rgba: state.work.data, w: r.w, h: r.h, labels: r.labels, R: r.R, groups: state.groups, faces: state.faces || [] }); k.faces_ = state.faces; r.kinds = k;
}
function previewInkFactory() {
  const long = Math.min(1100, Math.max(state.source.w, state.source.h));
  if (!inkCache || inkCache.res !== state.result || inkCache.long !== long) inkCache = { res: state.result, long, f: makeInkFactory(state.source, state.result, long) };
  return inkCache.f;
}
function rebuildScene() {
  if (!state.result) return;
  if (state.scene) releaseScene(state.scene);
  if (state.collage) { state.scene = buildCollageScene(collageCells((l) => l), state.params, { inkLong: 700 }); return; }
  computeGroups();
  state.scene = buildScene(state.result, state.groups, state.params, state.params.mode === 'hybrid' ? previewInkFactory() : null);
}
function redraw() {
  if (!state.result) return; rebuildScene(); paint(); updateBadges(); updateExportNote(state.scene); ensureTextFonts();
}
/** A shown text slot whose font is not loaded draws nothing (this hid text slots 2 and 3 when their default fonts were never opened in the font menu).
    Load what is missing, then redraw once; fonts that cannot be loaded are reported once instead of failing silently. */
let fontTok = 0; const warnedFonts = new Set();
function ensureTextFonts() {
  const miss = missingFonts(state.params);
  if (!miss.length) { for (const id of failedFonts(state.params)) if (!warnedFonts.has(id)) { warnedFonts.add(id); toast(t('tx.fontfail', { font: id })); } return; }
  const tok = ++fontTok; ensureFonts(state.params).then(() => { if (tok === fontTok && state.result) redraw(); });
}
// draws the current scene; when zoomed in, the canvas gets more pixels so the vector detail stays sharp
function paint() {
  const r = state.scene; if (!r || !state.result) return;
  const cv = $('cv-result'), box = $('stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), boost = Math.min(4, Math.max(1, Math.ceil(zoom ? zoom.getZoom() : 1)));
  const long = Math.min(boost > 1 ? 4096 : 2048, Math.max(400, Math.round(Math.max(box.width, 300) * dpr * boost))), k = long / Math.max(r.w, r.h);
  cv.width = Math.round(r.w * k); cv.height = Math.round(r.h * k); $('stage').style.setProperty('--ar', String(r.w / r.h));
  drawScene(cv, r, state.result.geom); if (handles) handles.update();
}
function drawOriginal() {
  const cv = $('cv-original'), r = state.result; if (!r) return; const src = state.canvas, k = Math.min(1, 1600 / Math.max(r.w, r.h));
  cv.width = Math.round(r.w * k) || r.w; cv.height = Math.round(r.h * k) || r.h; cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
}
function updateBadges() { $('badges').replaceChildren(); } // the info chips were removed from the preview (v0.5)

/* ---------- UI wiring ---------- */
function buildUI() {
  buildControls(onControl, setMode); buildStyleLibrary(); buildExtras(onControl, { shuffle: () => { state.params.collageSeed = (Math.random() * 1e6) | 0; saveSettings(); redraw(); }, add: () => { collageAppendNext = true; $('file-collage').click(); }, addCam: () => openCamera('multi', true, 'result') });
  const single = !state.collage; $('btn-edit').hidden = !single || !['silhouette', 'hybrid'].includes(state.params.mode); if ($('btn-edit').hidden) setEdit(false);
  $('btn-compare').hidden = !single; if (!single) compare.off(); $('btn-rerun').hidden = !single; $('btn-edit-reset').hidden = !single || !state.overrides.length; base = snapshot(); syncUndo();
}
async function onControl(key, value) {
  trackChange();
  if (/^textFont/.test(key)) await ensureFonts(state.params);
  if (key === 'preset') { state.params.preset = value; if (state.collage && state.params.collageVary) { state.params.collageVary = false; toast(t('col.bulk')); } if (state.params.mode === 'hybrid' || state.params.mode === 'regions') Object.assign(state.params, presetDefaults(state.params.mode, value)); buildUI(); saveSettings(); }
  clearTimeout(debounce); debounce = setTimeout(refresh, state.collage ? 350 : 130); buildStyleLibrary(); if (key === 'lock') renderRandomLock();
}
/** Applies a complete style (built-in or mine): every look parameter at once, one undo step. */
async function applyWholeStyle(np, name, opts = {}) {
  if (!state.result) return;
  // a built-in style recolours every collage piece, so per-piece varied palettes are switched off; a saved My Style is restored exactly as saved
  trackDiscrete(); state.params = np; if (!opts.exact && state.collage && state.params.collageVary) state.params.collageVary = false;
  await ensureFonts(state.params); saveSettings(); buildUI(); await refresh();
}
async function refresh() {
  const mySeq = ++state.seq; $('stage').style.opacity = '.85';
  try { if (state.collage) { if (!(await reprocessCollage(mySeq))) return; } else { await runPipeline(); } if (mySeq !== state.seq) return; redraw(); } catch (e) { console.error(e); toast(t('err.generic')); } finally { $('stage').style.opacity = ''; }
}
async function setMode(mode) {
  trackDiscrete();
  applyModeDefaults(mode); const list = MODE_PRESETS[mode];
  if (!list.includes(state.params.preset) && state.params.preset !== 'custom' && !(state.params.preset === 'random' && state.params.customPreset)) state.params.preset = list[0];
  if (state.params.preset === 'custom' && mode !== 'silhouette') state.params.preset = list[0];
  Object.assign(state.params, presetDefaults(mode, state.params.preset)); saveSettings(); buildUI(); refresh();
}
let hintTimer = 0;
const hideHint = () => { clearTimeout(hintTimer); $('edit-hint').hidden = true; };
function setEdit(on) { editing = on; $('btn-edit').setAttribute('aria-pressed', String(on)); $('stage').classList.toggle('editing', on); if (on) { $('edit-hint').hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 6000); } else hideHint(); $('btn-edit-reset').hidden = !on && !state.overrides.length; }
function onStageClick(ev) {
  if (!editing || !state.result || compare.isOn() || zoom.swallowClick() || ev.target.closest('.zoom-bar')) return;
  const cv = $('cv-result'), box = cv.getBoundingClientRect(), r = state.result, sc = Math.min(box.width / r.w, box.height / r.h), cw = r.w * sc, ch = r.h * sc;
  const rc = { left: box.left + (box.width - cw) / 2, top: box.top + (box.height - ch) / 2, width: cw, height: ch };
  const x = Math.floor(((ev.clientX - rc.left) / rc.width) * r.w), y = Math.floor(((ev.clientY - rc.top) / rc.height) * r.h);
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const cur = state.groups[r.labels[y * r.w + x]]; trackDiscrete(); hideHint(); state.overrides.push({ x, y, g: (cur + 1) % 3 }); $('btn-edit-reset').hidden = false; base = snapshot(); redraw();
}
async function getExportScene(kind) {
  const lite = /-lite$/.test(kind); if (lite) kind = kind.replace('-lite', '');
  const poster = kind === 'poster', vec = poster || (state.params.vecInk && (kind === 'svg' || kind === 'pdf'));
  await ensureFonts(state.params);
  const want = vec ? (poster ? Math.max(state.params.vecInkLong, 1400) : state.params.vecInkLong) : (kind === 'svg' || kind === 'pdf' ? LIMITS.hybridRasterMax : lite ? LIMITS.liteLong : state.params.exportLong);
  let scene, geom = null;
  if (state.collage) { scene = buildCollageScene(collageCells(() => want), { ...state.params, fxLong: want }, { inkLong: want }); }
  else {
    const r = state.result; computeGroups(); let f = null;
    if (state.params.mode === 'hybrid') { const srcLong = Math.max(state.source.w, state.source.h); f = makeInkFactory(state.source, r, Math.min(want, srcLong)); }
    scene = buildScene(r, state.groups, { ...state.params, fxLong: want }, f); geom = r.geom;
  }
  if (vec && sceneHasRaster(scene)) {
    cancelled = false; showProcessing('proc.vectorink', 0.02, { n: 0, m: 1 });
    try { await vectorizeScene(scene, (lab, w, h, R) => client.trace(lab, w, h, R, TRACE_SHAPE), { speck: state.params.vecInkSpeck, onProgress: (d, n) => showProcessing('proc.vectorink', 0.05 + 0.9 * (d / n), { n: Math.min(d + 1, n), m: n }) }); }
    finally { hideProcessing(); }
  }
  return { scene, geom };
}

/* ---------- wake lock ---------- */
function updateWakeUI() {
  const s = wake.status(), el = $('wake-status'); $('chk-wake').checked = state.params.wakeLock;
  el.textContent = !s.supported ? t('wake.unsupported') : !state.params.wakeLock ? t('wake.off') : s.active ? t('wake.on') : s.error ? t('wake.denied') : t('wake.on');
}
async function setWake(on) { state.params.wakeLock = on; saveSettings(); on ? await wake.enable() : await wake.disable(); updateWakeUI(); }

/* ---------- camera (see ui-camera.js) ---------- */
let camUI = null;
const openCamera = (mode = 'single', append = false, from = 'hub') => { camFrom = from; return camUI.open(mode, append); };

/* ---------- randomise ---------- */
const snapshot = () => ({ params: JSON.parse(JSON.stringify(state.params)), overrides: state.overrides.slice() });
async function doRandom() {
  if (!state.result) return;
  trackDiscrete();
  const o = state.params.rndOpts, solo = !state.collage; if (solo) computeGroups();
  const seed = (Math.random() * 4294967296) >>> 0;
  const out = randomize(seed, { ...o, tendency: state.params.rndStyle }, state.params, solo ? state.result : null, solo ? state.groups : null, { collage: !!state.collage });
  Object.assign(state.params, out.params);
  if (out.overrides && solo) state.overrides = out.overrides;
  await ensureFonts({ ...state.params, ...out.params });
  saveSettings(); buildUI(); await refresh();
}
/* ---------- undo / redo (edit sheet header) ----------
   `base` is the state before the current edit gesture; a pause of 600 ms starts a new undo step, so a slider drag is one step. */
function trackChange() {
  const now = performance.now();
  if (base && now - lastT > 600) { undoH.push(base); redoH.clear(); }
  lastT = now; base = snapshot(); syncUndo();
}
function trackDiscrete() { undoH.push(snapshot()); redoH.clear(); lastT = 0; syncUndo(); } // call BEFORE the change
function resetHistory() { undoH.clear(); redoH.clear(); lastT = 0; base = snapshot(); syncUndo(); }
function syncUndo() { $('sheet-undo').disabled = !undoH.size; $('sheet-redo').disabled = !redoH.size; }
async function stepHistory(from, to) {
  const snap = from.pop(); if (!snap) return;
  to.push(snapshot()); state.params = snap.params; state.overrides = snap.overrides; lastT = 0;
  await ensureFonts(state.params); saveSettings(); buildUI(); await refresh();
}
const undo = () => stepHistory(undoH, redoH), redo = () => stepHistory(redoH, undoH);

/* ---------- init ---------- */
function init() {
  loadSettings(); initLang(); $('sel-quality').value = state.params.quality;
  document.addEventListener('vc:lang', () => { updateWakeUI(); if (state.result) { buildUI(); updateBadges(); updateExportNote(state.scene); } $('btn-lang').textContent = t('lang.toggle'); });
  $('btn-lang').addEventListener('click', () => setLang(getLang() === 'ja' ? 'en' : 'ja'));
  $('sel-quality').addEventListener('change', (e) => { state.params.quality = e.target.value; saveSettings(); });
  client = new PipelineClient(onPipeProgress); zoom = initZoom({ onSettle: () => { if (state.scene && $('screen-result').classList.contains('active')) paint(); }, isCompare: () => compare.isOn() }); compare = initCompare(() => zoom.pinching()); initStageFrame(); initSheet(); initLayout(); handles = initTextHandles({ onChange: (k) => onControl(k) }); initAbout(); initExport(getExportScene);
  camUI = initCameraUI({ onSingle: (cv) => startWithSource(cv), onMulti: async (list, append) => { state.collageBusy = true; try { await addCollageFiles(list, append); } finally { state.collageBusy = false; } }, back: () => { if (camFrom === 'result' && state.result) resumeEdit(); else showHub(); }, toast });
  initAB();
  document.addEventListener('vc:face-engine', (e) => { // explicit engine switch: store this engine's artistic profile, load the other's, detect again, redraw
    state.params = switchEngine(syncActiveProfile(state.params), e.detail); saveSettings(); state.faces = undefined; state.facesEngine = e.detail; state.faceStatus = null; if (state.result) state.result.kinds = null; buildControls(onControl, setMode); if (state.result) redraw();
  });
  hub = initHub({ hasSession: () => !!state.result, camera: (m) => openCamera(m, false, 'hub'), choose: () => $('file-input').click(), collageCamera: () => openCamera('multi', false, 'hub'), collageChoose: () => { collageAppendNext = false; $('file-collage').click(); }, resume: resumeEdit });
  $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) startWithSource(f); });
  $('btn-photo').addEventListener('click', showHub); $('tb-camera').addEventListener('click', showHub);
  $('file-collage').addEventListener('change', async (e) => { const fl = [...e.target.files], append = collageAppendNext; e.target.value = ''; collageAppendNext = false; if (fl.length) { state.collageBusy = true; try { await addCollageFiles(fl, append); } finally { state.collageBusy = false; } } });
  $('btn-random').addEventListener('click', doRandom); $('sheet-undo').addEventListener('click', undo); $('sheet-redo').addEventListener('click', redo);
  ensureFonts(state.params); initStyleLibrary({ apply: applyWholeStyle });
  $('btn-rerun').addEventListener('click', () => { trackDiscrete(); state.overrides = []; base = snapshot(); analyze(); });
  $('btn-edit').addEventListener('click', () => setEdit(!editing));
  $('btn-edit-reset').addEventListener('click', () => { trackDiscrete(); state.overrides = []; base = snapshot(); setEdit(editing); if (!editing) $('btn-edit-reset').hidden = true; redraw(); });
  $('stage').addEventListener('click', onStageClick); $('toolbar').addEventListener('click', hideHint);
  $('btn-proc-cancel').addEventListener('click', () => { cancelled = true; state.seq++; client.cancel(); pipeStale = !!state.work; rollbackReplace(); hideProcessing(); toast(t('proc.cancelled')); if (state.result) resumeEdit(); else showHub(); });
  $('chk-wake').addEventListener('change', (e) => setWake(e.target.checked));
  wake.init(); wake.onChange(updateWakeUI); setWake(state.params.wakeLock);
  new ResizeObserver(() => { clearTimeout(init._r); init._r = setTimeout(() => { if ($('screen-result').classList.contains('active')) redraw(); }, 150); }).observe($('stage'));
  document.title = document.title; $('btn-lang').textContent = t('lang.toggle');
  window.__vc = { state, versionString }; registerSW(); applyDom();
}
init();
