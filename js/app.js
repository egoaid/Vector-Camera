// app.js - application bootstrap and orchestration (input -> analysis -> style -> export).
import { initLang, setLang, getLang, t, applyDom } from './i18n.js';
import { state, loadSettings, saveSettings, applyModeDefaults } from './state.js';
import { LIMITS, MODE_PRESETS, pipelineParams } from './config.js';
import { versionString } from './version.js';
import * as wake from './wake-lock.js';
import { initCameraUI } from './ui-camera.js';
import { loadSource, makeWorking } from './image-input.js';
import { PipelineClient } from './pipeline-client.js';
import { runSegformer, cancelAI, isSupported as aiSupported } from './seg-segformer.js';
import { classifyGroups } from './seg-saliency.js';
import { buildScene, sceneHasRaster } from './style-scene.js';
import { buildCollageScene } from './style-collage.js';
import { vectorizeScene } from './vec-ink.js';
import { TRACE_SHAPE } from './vec-ink.js';
import { randomize, History } from './style-random.js';
import { buildExtras } from './ui-extras.js';
import { ensureFonts } from './style-text.js';
import { makeInkFactory } from './render-ink.js';
import { drawScene, releaseScene } from './render-canvas.js';
import { showScreen, showProcessing, hideProcessing, showError } from './ui-views.js';
import { buildControls, presetDefaults } from './ui-controls.js';
import { initCompare } from './ui-compare.js';
import { initZoom } from './ui-zoom.js';
import { initStageFrame } from './ui-stage.js';
import { initTextHandles } from './ui-textbox.js';
import { initExport, updateExportNote } from './ui-export.js';
import { initAbout } from './ui-about.js';
import { registerSW } from './pwa.js';
import { toast } from './ui-toast.js';
import { PRESETS, getPreset } from './style-palette.js';

const $ = (id) => document.getElementById(id);
const STAGE_KEY = { segment: 'proc.segment', merge: 'proc.merge', regions: 'proc.regions', vectorize: 'proc.vectorize', done: 'proc.done' };
const history = new History();
let client, compare, zoom, handles, lastKey = '', pipeStale = false, inkCache = null, debounce = 0, editing = false, aiConsent = false, cancelled = false;

/* ---------- processing helpers ---------- */
const onPipeProgress = (stage, f) => { if (!$('processing').hidden && !state.collageBusy) showProcessing(STAGE_KEY[stage] || 'proc.segment', 0.4 + 0.55 * f); };
async function ensurePipeline() {
  if (!pipeStale) return; pipeStale = false;
  await client.setImage(state.work.w, state.work.h, state.work.data); await client.setSemantic(state.sem); lastKey = '';
}
const yieldUI = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/* ---------- load + analyse ---------- */
async function startWithSource(fileOrCanvas) {
  showProcessing('proc.prepare', 0.03); await yieldUI();
  try {
    const { source, canvas } = await loadSource(fileOrCanvas);
    state.source = source; state.canvas = canvas; state.overrides = []; editing = false; state.collage = null;
    await analyze();
  } catch (e) { console.error(e); hideProcessing(); showScreen('start'); showError('start-error', t(/memory|alloc/i.test(String(e && e.message)) ? 'err.memory' : 'err.load')); }
}
async function analyze() {
  cancelled = false; const mySeq = ++state.seq;
  showProcessing('proc.prepare', 0.08); await yieldUI();
  state.work = makeWorking(state.canvas, state.params.quality);
  state.sem = null; state.engineUsed = 'classic'; pipeStale = false; lastKey = '';
  await client.setImage(state.work.w, state.work.h, state.work.data); await client.setSemantic(null);
  if (state.params.engine === 'ai' && aiSupported()) await tryAI();
  if (cancelled || mySeq !== state.seq) return;
  showProcessing('proc.segment', 0.4);
  try { await runPipeline(true); } catch (e) { if (cancelled) return; console.error(e); hideProcessing(); toast(t('err.generic')); if (!state.result) showScreen('start'); return; }
  if (cancelled) return;
  hideProcessing(); showScreen('result'); zoom.reset(); buildUI(); await ensureFonts(state.params); await yieldUI(); redraw(); drawOriginal();
}
async function tryAI() {
  if (!aiConsent) {
    let ok = false; try { ok = localStorage.getItem('vc.aiConsent') === '1'; } catch { /* ignore */ }
    if (!ok) { hideProcessing(); ok = await askAI(); showProcessing('proc.prepare', 0.1); }
    if (!ok) { state.params.engine = 'classic'; $('sel-engine').value = 'classic'; return; }
    aiConsent = true; try { localStorage.setItem('vc.aiConsent', '1'); } catch { /* ignore */ }
  }
  try {
    showProcessing('proc.ai', 0.15); let fromCache = false;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
    const sem = await runSegformer(state.work, (d) => {
      if (d.status === 'cache') { fromCache = !!d.cached; if (fromCache) showProcessing('proc.cached', 0.2); }
      else if (d.status === 'progress' && d.total && fromCache) showProcessing('proc.cached', 0.15 + 0.2 * (d.loaded / d.total));
      else if (d.status === 'progress' && d.total) showProcessing('proc.download', 0.15 + 0.2 * (d.loaded / d.total), { pct: Math.round((d.loaded / d.total) * 100) });
      else if (d.status === 'inference') showProcessing('proc.ai', 0.36);
    });
    state.sem = sem; await client.setSemantic(sem); state.engineUsed = 'ai';
  } catch (e) { if (cancelled) return; console.warn('segmentation model failed', e); state.engineUsed = 'classic'; toast(t('err.ai'), { ms: 7000 }); }
}
function askAI() {
  return new Promise((resolve) => { const d = $('dlg-ai'); d.addEventListener('close', () => resolve(d.returnValue === 'go'), { once: true }); d.returnValue = 'no'; d.showModal(); });
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
  if (!append) state.collage = null;
  const list = [...files].filter((f) => f instanceof HTMLCanvasElement || /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name)).slice(0, 12 - (state.collage ? state.collage.cells.length : 0));
  if (!list.length) return;
  cancelled = false; const mySeq = ++state.seq; const cells = state.collage ? state.collage.cells : [];
  try {
    for (let i = 0; i < list.length; i++) {
      showProcessing('proc.collage', (i + 0.1) / list.length * 0.9, { n: i + 1, m: list.length }); await yieldUI();
      const { source, canvas } = await loadSource(list[i]); const cell = { source, canvas }; await processCell(cell); if (cancelled || mySeq !== state.seq) return; cells.push(cell);
    }
  } catch (e) { console.error(e); hideProcessing(); toast(t('err.load')); if (!cells.length) showScreen('start'); return; }
  state.collage = { cells }; state.result = cells[0].res; state.source = cells[0].source; state.canvas = cells[0].canvas; state.overrides = []; editing = false;
  if (state.params.mode === 'vector' || state.params.mode === 'silhouette') { /* all modes work per piece */ }
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
  if (!state.result) return; rebuildScene(); paint(); updateBadges(); updateExportNote(state.scene);
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
function updateBadges() {
  const b = $('badges'); b.replaceChildren(); const add = (txt, warn) => { const s = document.createElement('span'); s.className = 'badge' + (warn ? ' warn' : ''); s.textContent = txt; b.append(s); };
  add(t(sceneHasRaster(state.scene) ? 'badge.hybrid' : 'badge.vector'), sceneHasRaster(state.scene));
  if (state.collage) add(t('badge.collage', { n: state.collage.cells.length })); else { add(t(state.engineUsed === 'ai' ? 'badge.ai' : 'badge.classic')); add(t('badge.regions', { n: state.result.R })); }
}

/* ---------- UI wiring ---------- */
function buildUI() {
  buildControls(onControl, setMode); buildExtras(onControl, { shuffle: () => { state.params.collageSeed = (Math.random() * 1e6) | 0; saveSettings(); redraw(); }, add: () => $('file-collage').click(), addCam: () => openCamera('multi', true) });
  const single = !state.collage; $('btn-edit').hidden = !single || !['silhouette', 'hybrid'].includes(state.params.mode); if ($('btn-edit').hidden) setEdit(false);
  $('btn-compare').hidden = !single; if (!single) compare.off(); $('btn-rerun').hidden = !single; $('btn-edit-reset').hidden = !single || !state.overrides.length; $('btn-random-undo').disabled = !history.size;
}
async function onControl(key, value) {
  if (key === 'textFont') await ensureFonts(state.params);
  if (key === 'preset') { state.params.preset = value; if (state.collage && state.params.collageVary) { state.params.collageVary = false; toast(t('col.bulk')); } if (state.params.mode === 'hybrid' || state.params.mode === 'regions') Object.assign(state.params, presetDefaults(state.params.mode, value)); buildUI(); saveSettings(); }
  clearTimeout(debounce); debounce = setTimeout(refresh, state.collage ? 350 : 130);
}
async function refresh() {
  const mySeq = ++state.seq; $('stage').style.opacity = '.85';
  try { if (state.collage) { if (!(await reprocessCollage(mySeq))) return; } else { await runPipeline(); } if (mySeq !== state.seq) return; redraw(); } catch (e) { console.error(e); toast(t('err.generic')); } finally { $('stage').style.opacity = ''; }
}
async function setMode(mode) {
  applyModeDefaults(mode); const list = MODE_PRESETS[mode];
  if (!list.includes(state.params.preset) && state.params.preset !== 'custom' && !(state.params.preset === 'random' && state.params.customPreset)) state.params.preset = list[0];
  if (state.params.preset === 'custom' && mode !== 'silhouette') state.params.preset = list[0];
  Object.assign(state.params, presetDefaults(mode, state.params.preset)); saveSettings(); buildUI(); refresh();
}
function setEdit(on) { editing = on; $('btn-edit').setAttribute('aria-pressed', String(on)); $('stage').classList.toggle('editing', on); $('edit-hint').hidden = !on; $('btn-edit-reset').hidden = !on && !state.overrides.length; }
function onStageClick(ev) {
  if (!editing || !state.result || compare.isOn() || zoom.swallowClick() || ev.target.closest('.zoom-bar')) return;
  const cv = $('cv-result'), box = cv.getBoundingClientRect(), r = state.result, sc = Math.min(box.width / r.w, box.height / r.h), cw = r.w * sc, ch = r.h * sc;
  const rc = { left: box.left + (box.width - cw) / 2, top: box.top + (box.height - ch) / 2, width: cw, height: ch };
  const x = Math.floor(((ev.clientX - rc.left) / rc.width) * r.w), y = Math.floor(((ev.clientY - rc.top) / rc.height) * r.h);
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const cur = state.groups[r.labels[y * r.w + x]]; state.overrides.push({ x, y, g: (cur + 1) % 3 }); $('btn-edit-reset').hidden = false; redraw();
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
const openCamera = (mode = 'single', append = false) => camUI.open(mode, append);

/* ---------- randomise ---------- */
const snapshot = () => ({ params: JSON.parse(JSON.stringify(state.params)), overrides: state.overrides.slice() });
async function doRandom() {
  if (!state.result) return;
  history.push(snapshot());
  const o = state.params.rndOpts, solo = !state.collage; if (solo) computeGroups();
  const seed = (Math.random() * 4294967296) >>> 0;
  const out = randomize(seed, { ...o }, state.params, solo ? state.result : null, solo ? state.groups : null, { collage: !!state.collage });
  Object.assign(state.params, out.params);
  if (out.overrides && solo) state.overrides = out.overrides;
  await ensureFonts({ ...state.params, ...out.params });
  saveSettings(); buildUI(); await refresh();
}
async function undoRandom() {
  const snap = history.pop(); if (!snap) return;
  state.params = snap.params; state.overrides = snap.overrides; await ensureFonts(state.params); saveSettings(); buildUI(); await refresh();
}

/* ---------- init ---------- */
function init() {
  loadSettings(); initLang(); $('sel-engine').value = state.params.engine; $('sel-quality').value = state.params.quality;
  const note = () => { $('engine-note').textContent = t(state.params.engine === 'ai' ? 'engine.note.ai' : 'engine.note.classic'); };
  note(); document.addEventListener('vc:lang', () => { note(); updateWakeUI(); if (state.result) { buildUI(); updateBadges(); updateExportNote(state.scene); } $('btn-lang').textContent = t('lang.toggle'); });
  $('btn-lang').addEventListener('click', () => setLang(getLang() === 'ja' ? 'en' : 'ja'));
  $('sel-engine').addEventListener('change', (e) => { state.params.engine = e.target.value; note(); saveSettings(); });
  $('sel-quality').addEventListener('change', (e) => { state.params.quality = e.target.value; saveSettings(); });
  client = new PipelineClient(onPipeProgress); zoom = initZoom({ onSettle: () => { if (state.scene && $('screen-result').classList.contains('active')) paint(); }, isCompare: () => compare.isOn() }); compare = initCompare(() => zoom.pinching()); initStageFrame(); handles = initTextHandles({ onChange: (k) => onControl(k) }); initAbout(); initExport(getExportScene);
  camUI = initCameraUI({ onSingle: (cv) => startWithSource(cv), onMulti: async (list, append) => { state.collageBusy = true; try { await addCollageFiles(list, append); } finally { state.collageBusy = false; } }, back: () => showScreen(state.result ? 'result' : 'start'), toast });
  $('btn-camera').addEventListener('click', () => openCamera('single'));
  $('btn-collage-cam').addEventListener('click', () => { state.collage = null; openCamera('multi', false); });
  $('btn-choose').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) startWithSource(f); });
  $('btn-new').addEventListener('click', () => { showScreen('start'); });
  $('btn-retake').addEventListener('click', () => openCamera('single'));
  $('btn-collage').addEventListener('click', () => { state.collage = null; $('file-collage').click(); });
  $('file-collage').addEventListener('change', async (e) => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) { state.collageBusy = true; try { await addCollageFiles(fl, !!state.collage); } finally { state.collageBusy = false; } } });
  $('btn-random').addEventListener('click', doRandom); $('btn-random-undo').addEventListener('click', undoRandom);
  ensureFonts(state.params);
  $('btn-rerun').addEventListener('click', () => { state.overrides = []; analyze(); });
  $('btn-edit').addEventListener('click', () => setEdit(!editing));
  $('btn-edit-reset').addEventListener('click', () => { state.overrides = []; setEdit(editing); if (!editing) $('btn-edit-reset').hidden = true; redraw(); });
  $('stage').addEventListener('click', onStageClick);
  $('btn-proc-cancel').addEventListener('click', () => { cancelled = true; state.seq++; client.cancel(); cancelAI(); pipeStale = !!state.work; hideProcessing(); toast(t('proc.cancelled')); showScreen(state.result ? 'result' : 'start'); });
  $('chk-wake').addEventListener('change', (e) => setWake(e.target.checked));
  wake.init(); wake.onChange(updateWakeUI); setWake(state.params.wakeLock);
  new ResizeObserver(() => { clearTimeout(init._r); init._r = setTimeout(() => { if ($('screen-result').classList.contains('active')) redraw(); }, 150); }).observe($('stage'));
  document.title = document.title; $('btn-lang').textContent = t('lang.toggle');
  window.__vc = { state, versionString }; registerSW(); applyDom();
}
init();
