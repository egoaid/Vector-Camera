// ui-export.js - export buttons (SVG / PDF / PNG / JPEG), share sheet and notes.
import { t } from './i18n.js';
import { makeBlob, download, fileName, canShareFiles, share } from './export-files.js';
import { releaseScene } from './render-canvas.js';
import { sceneHasRaster } from './style-scene.js';
import { toast } from './ui-toast.js';
import { state, saveSettings } from './state.js';
const $ = (id) => document.getElementById(id);

export function initExport(getExportScene) {
  const buttons = [...document.querySelectorAll('[data-export]')];
  $('sel-export-size').value = String(state.params.exportLong);
  $('sel-export-size').addEventListener('change', (e) => { state.params.exportLong = +e.target.value; saveSettings(); });
  if (navigator.share && navigator.canShare) $('share-wrap').hidden = false;
  $('chk-vecink').checked = !!state.params.vecInk; $('vecink-opts').hidden = !state.params.vecInk; $('sel-vecink-long').value = String(state.params.vecInkLong);
  $('chk-vecink').addEventListener('change', (e) => { state.params.vecInk = e.target.checked; $('vecink-opts').hidden = !e.target.checked; saveSettings(); updateExportNote(state.scene); });
  $('sel-vecink-long').addEventListener('change', (e) => { state.params.vecInkLong = +e.target.value; saveSettings(); });
  for (const b of buttons) b.addEventListener('click', async () => {
    if (!state.result) return; const kind = b.dataset.export;
    buttons.forEach((x) => { x.disabled = true; }); $('export-note').textContent = t('exp.working');
    let built = null;
    try {
      built = await getExportScene(kind);
      const poster = kind === 'poster', longPx = poster ? +$('sel-poster').value : state.params.exportLong;
      const blob = await makeBlob(kind, built.scene, built.geom, { longPx, onProgress: (f) => { $('export-note').textContent = t('exp.poster.working', { pct: Math.round(f * 100) }); } }), ext = kind === 'jpeg' ? 'jpg' : kind === 'poster' ? 'png' : kind, name = fileName(built.scene, ext).replace(/\.png$/, poster ? '_poster.png' : '.png');
      if ($('chk-share').checked && canShareFiles(blob, name)) await share(blob, name); else download(blob, name);
      $('export-note').textContent = t('exp.done', { name });
    } catch (e) { if (e && (e.name === 'AbortError' || e.message === 'cancelled')) $('export-note').textContent = ''; else { $('export-note').textContent = t('err.generic'); console.error(e); toast(t('err.generic')); } }
    finally { if (built) releaseScene(built.scene); buttons.forEach((x) => { x.disabled = false; }); }
  });
}
export function updateExportNote(scene) { if (scene) $('export-note').textContent = sceneHasRaster(scene) && !state.params.vecInk ? t('exp.note.hybrid') : sceneHasRaster(scene) ? t('exp.note.vecink') : t('exp.note.vector'); }
