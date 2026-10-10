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
  for (const b of buttons) b.addEventListener('click', async () => {
    if (!state.result) return; const kind = b.dataset.export;
    buttons.forEach((x) => { x.disabled = true; }); $('export-note').textContent = t('exp.working');
    let built = null;
    try {
      built = await getExportScene(kind);
      const blob = await makeBlob(kind, built.scene, built.geom, { longPx: state.params.exportLong }), ext = kind === 'jpeg' ? 'jpg' : kind, name = fileName(built.scene, ext);
      if ($('chk-share').checked && canShareFiles(blob, name)) await share(blob, name); else download(blob, name);
      $('export-note').textContent = t('exp.done', { name });
    } catch (e) { if (e && e.name === 'AbortError') $('export-note').textContent = ''; else { $('export-note').textContent = t('err.generic'); console.error(e); toast(t('err.generic')); } }
    finally { if (built) releaseScene(built.scene); buttons.forEach((x) => { x.disabled = false; }); }
  });
}
export function updateExportNote(scene) { if (scene) $('export-note').textContent = sceneHasRaster(scene) ? t('exp.note.hybrid') : t('exp.note.vector'); }
