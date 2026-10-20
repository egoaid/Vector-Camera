// ui-inkfx.js - "ink effects" panel: ink stains / bleed and ink spatter over the whole picture (every mode).
import { state, saveSettings } from './state.js';
import { t } from './i18n.js';
import { slider } from './ui-controls.js';
const $ = (id) => document.getElementById(id);

export function buildInkFxPanel(onChange) {
  const box = $('inkfx-ctl'); if (!box) return; box.replaceChildren();
  const note = document.createElement('p'); note.className = 'note'; note.textContent = t('ix.note'); box.append(note);
  for (const k of ['inkStain', 'inkSplat']) box.append(slider({ k, min: 0, max: 100 }, onChange));
  const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn btn-small'; rb.textContent = t('ix.reseed');
  rb.addEventListener('click', () => { state.params.inkSeed = (Math.random() * 1e6) | 0; saveSettings(); onChange('inkSeed'); });
  const row = document.createElement('div'); row.className = 'retake-row'; row.append(rb); box.append(row);
}
