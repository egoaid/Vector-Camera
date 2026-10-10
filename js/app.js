// app.js - application bootstrap and orchestration (input -> analysis -> style -> export).
import { initLang, setLang, getLang, t, applyDom } from './i18n.js';
import { state, loadSettings, saveSettings, applyModeDefaults } from './state.js';
import { LIMITS, MODE_PRESETS, pipelineParams } from './config.js';
import { versionString } from './version.js';
import * as wake from './wake-lock.js';
import * as cam from './camera.js';
import { loadSource, makeWorking } from './image-input.js';
import { PipelineClient } from './pipeline-client.js';
import { runSegformer, cancelAI, isSupported as aiSupported } from './seg-segformer.js';
import { classifyGroups } from './seg-saliency.js';
import { buildScene, sceneHasRaster } from './style-scene.js';
import { makeInkFactory } from './render-ink.js';
import { drawScene, releaseScene } from './render-canvas.js';
import { showScreen, showProcessing, hideProcessing, showError } from './ui-views.js';
import { buildControls, presetDefaults } from './ui-controls.js';
import { initCompare } from './ui-compare.js';
import { initExport, updateExportNote } from './ui-export.js';
import { initAbout } from './ui-about.js';
import { registerSW } from './pwa.js';
import { toast } from './ui-toast.js';
import { PRESETS } from './style-palette.js';

const $ = (id) => document.getElementById(id);
const STAGE_KEY = { segment: 'proc.segment', merge: 'proc.merge', regions: 'proc.regions', vectorize: 'proc.vectorize', done: 'proc.done' };
let client, compare, lastKey = '', pipeStale = false, inkCache = null, debounce = 0, editing = false, aiConsent = false, cancelled = false;

/* ---------- processing helpers ---------- */
const onPipeProgress = (stage, f) => { if (!$('processing').hidden) showProcessing(STAGE_KEY[stage] || 'proc.segment', 0.4 + 0.55 * f); };
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
    state.source = source; state.canvas = canvas; state.overrides = []; editing = false;
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
  hideProcessing(); showScreen('result'); buildUI(); await yieldUI(); redraw(); drawOriginal();
}
async function tryAI() {
  if (!aiConsent) {
    let ok = false; try { ok = localStorage.getItem('vc.aiConsent') === '1'; } catch { /* ignore */ }
    if (!ok) { hideProcessing(); ok = await askAI(); showProcessing('proc.prepare', 0.1); }
    if (!ok) { state.params.engine = 'classic'; $('sel-engine').value = 'classic'; return; }
    aiConsent = true; try { localStorage.setItem('vc.aiConsent', '1'); } catch { /* ignore */ }
  }
  try {
    showProcessing('proc.ai', 0.15);
    const sem = await runSegformer(state.work, (d) => {
      if (d.status === 'progress' && d.total) showProcessing('proc.download', 0.15 + 0.2 * (d.loaded / d.total), { pct: Math.round((d.loaded / d.total) * 100) });
      else if (d.status === 'inference') showProcessing('proc.ai', 0.36);
    });
    state.sem = sem; await client.setSemantic(sem); state.engineUsed = 'ai';
  } catch (e) { if (cancelled) return; console.warn('AI route failed', e); state.engineUsed = 'classic'; toast(t('err.ai'), { ms: 7000 }); }
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
  if (!state.result) return; computeGroups();
  if (state.scene) releaseScene(state.scene);
  state.scene = buildScene(state.result, state.groups, state.params, state.params.mode === 'hybrid' ? previewInkFactory() : null);
}
function redraw() {
  if (!state.result) return; rebuildScene();
  const cv = $('cv-result'), box = $('stage').getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), r = state.result;
  const long = Math.min(2048, Math.max(400, Math.round(Math.max(box.width, 300) * dpr))), k = long / Math.max(r.w, r.h);
  cv.width = Math.round(r.w * k); cv.height = Math.round(r.h * k); $('stage').style.setProperty('--ar', String(r.w / r.h));
  drawScene(cv, state.scene, r.geom); updateBadges(); updateExportNote(state.scene);
}
function drawOriginal() {
  const cv = $('cv-original'), r = state.result; if (!r) return; const src = state.canvas, k = Math.min(1, 1600 / Math.max(r.w, r.h));
  cv.width = Math.round(r.w * k) || r.w; cv.height = Math.round(r.h * k) || r.h; cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
}
function updateBadges() {
  const b = $('badges'); b.replaceChildren(); const add = (txt, warn) => { const s = document.createElement('span'); s.className = 'badge' + (warn ? ' warn' : ''); s.textContent = txt; b.append(s); };
  add(t(sceneHasRaster(state.scene) ? 'badge.hybrid' : 'badge.vector'), sceneHasRaster(state.scene));
  add(t(state.engineUsed === 'ai' ? 'badge.ai' : 'badge.classic')); add(t('badge.regions', { n: state.result.R }));
}

/* ---------- UI wiring ---------- */
function buildUI() { buildControls(onControl, setMode); $('btn-edit').hidden = !['silhouette', 'hybrid'].includes(state.params.mode); if ($('btn-edit').hidden) setEdit(false); }
async function onControl(key, value) {
  if (key === 'preset') { state.params.preset = value; if (state.params.mode === 'hybrid' || state.params.mode === 'regions') Object.assign(state.params, presetDefaults(state.params.mode, value)); buildUI(); saveSettings(); }
  clearTimeout(debounce); debounce = setTimeout(refresh, 130);
}
async function refresh() {
  const mySeq = ++state.seq; $('stage').style.opacity = '.85';
  try { await runPipeline(); if (mySeq !== state.seq) return; redraw(); } catch (e) { console.error(e); toast(t('err.generic')); } finally { $('stage').style.opacity = ''; }
}
async function setMode(mode) {
  applyModeDefaults(mode); const list = MODE_PRESETS[mode];
  if (!list.includes(state.params.preset) && state.params.preset !== 'custom') state.params.preset = list[0];
  if (state.params.preset === 'custom' && mode !== 'silhouette') state.params.preset = list[0];
  Object.assign(state.params, presetDefaults(mode, state.params.preset)); saveSettings(); buildUI(); refresh();
}
function setEdit(on) { editing = on; $('btn-edit').setAttribute('aria-pressed', String(on)); $('stage').classList.toggle('editing', on); $('edit-hint').hidden = !on; $('btn-edit-reset').hidden = !on && !state.overrides.length; }
function onStageClick(ev) {
  if (!editing || !state.result || compare.isOn()) return;
  const cv = $('cv-result'), rc = cv.getBoundingClientRect(), r = state.result;
  const x = Math.floor(((ev.clientX - rc.left) / rc.width) * r.w), y = Math.floor(((ev.clientY - rc.top) / rc.height) * r.h);
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const cur = state.groups[r.labels[y * r.w + x]]; state.overrides.push({ x, y, g: (cur + 1) % 3 }); $('btn-edit-reset').hidden = false; redraw();
}
async function getExportScene(kind) {
  const r = state.result; computeGroups(); let f = null;
  if (state.params.mode === 'hybrid') { const srcLong = Math.max(state.source.w, state.source.h), want = kind === 'svg' || kind === 'pdf' ? LIMITS.hybridRasterMax : state.params.exportLong; f = makeInkFactory(state.source, r, Math.min(want, srcLong)); }
  return { scene: buildScene(r, state.groups, state.params, f), geom: r.geom };
}

/* ---------- wake lock ---------- */
function updateWakeUI() {
  const s = wake.status(), el = $('wake-status'); $('chk-wake').checked = state.params.wakeLock;
  el.textContent = !s.supported ? t('wake.unsupported') : !state.params.wakeLock ? t('wake.off') : s.active ? t('wake.on') : s.error ? t('wake.denied') : t('wake.on');
}
async function setWake(on) { state.params.wakeLock = on; saveSettings(); on ? await wake.enable() : await wake.disable(); updateWakeUI(); }

/* ---------- camera ---------- */
async function openCamera() {
  showError('start-error', ''); if (!cam.isSupported()) return showError('start-error', t('camera.unsupported'));
  showScreen('camera'); showError('camera-error', '');
  try { await cam.start($('video')); } catch (e) { cam.stop(); showScreen('start'); showError('start-error', t(cam.errorKey(e))); }
}
function closeCamera() { cam.stop(); showScreen(state.result ? 'result' : 'start'); }

/* ---------- init ---------- */
function init() {
  loadSettings(); initLang(); $('sel-engine').value = state.params.engine; $('sel-quality').value = state.params.quality;
  const note = () => { $('engine-note').textContent = t(state.params.engine === 'ai' ? 'engine.note.ai' : 'engine.note.classic'); };
  note(); document.addEventListener('vc:lang', () => { note(); updateWakeUI(); if (state.result) { buildUI(); updateBadges(); updateExportNote(state.scene); } $('btn-lang').textContent = t('lang.toggle'); });
  $('btn-lang').addEventListener('click', () => setLang(getLang() === 'ja' ? 'en' : 'ja'));
  $('sel-engine').addEventListener('change', (e) => { state.params.engine = e.target.value; note(); saveSettings(); });
  $('sel-quality').addEventListener('change', (e) => { state.params.quality = e.target.value; saveSettings(); });
  client = new PipelineClient(onPipeProgress); compare = initCompare(); initAbout(); initExport(getExportScene);
  $('btn-camera').addEventListener('click', openCamera);
  $('btn-choose').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) startWithSource(f); });
  $('btn-cam-close').addEventListener('click', closeCamera);
  $('btn-cam-switch').addEventListener('click', async () => { try { await cam.start($('video'), true); } catch (e) { showError('camera-error', t(cam.errorKey(e))); } });
  $('btn-shutter').addEventListener('click', () => { const cv = cam.capture($('video')); cam.stop(); startWithSource(cv); });
  $('btn-new').addEventListener('click', () => { showScreen('start'); });
  $('btn-rerun').addEventListener('click', () => { state.overrides = []; analyze(); });
  $('btn-edit').addEventListener('click', () => setEdit(!editing));
  $('btn-edit-reset').addEventListener('click', () => { state.overrides = []; setEdit(editing); if (!editing) $('btn-edit-reset').hidden = true; redraw(); });
  $('stage').addEventListener('click', onStageClick);
  $('btn-proc-cancel').addEventListener('click', () => { cancelled = true; state.seq++; client.cancel(); cancelAI(); pipeStale = !!state.work; hideProcessing(); toast(t('proc.cancelled')); showScreen(state.result ? 'result' : 'start'); });
  $('chk-wake').addEventListener('change', (e) => setWake(e.target.checked));
  wake.init(); wake.onChange(updateWakeUI); setWake(state.params.wakeLock);
  new ResizeObserver(() => { clearTimeout(init._r); init._r = setTimeout(() => { if ($('screen-result').classList.contains('active')) redraw(); }, 150); }).observe($('stage'));
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('screen-camera').classList.contains('active')) closeCamera(); });
  document.title = document.title; $('btn-lang').textContent = t('lang.toggle');
  window.__vc = { state, versionString }; registerSW(); applyDom();
}
init();
