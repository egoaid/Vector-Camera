// ui-frame.js - "margin / print edge" controls (shape tab): margin width, extra bottom margin, ink bleed, edge wear, crookedness, margin colour, re-roll.
import { state, saveSettings } from './state.js';
import { t } from './i18n.js';
import { slider } from './ui-controls.js';
import { getPreset } from './style-palette.js';
const $ = (id) => document.getElementById(id);

export function buildFramePanel(onChange) {
  const box = $('frame-ctl'); if (!box) return; box.replaceChildren(); const p = state.params;
  const note = document.createElement('p'); note.className = 'note'; note.textContent = t('fr.note'); box.append(note);
  const shown = p.frame > 0; // the other controls appear once a margin is set (the panel is rebuilt only when that flips, not on every drag step)
  box.append(slider({ k: 'frame', min: 0, max: 100 }, (k) => { onChange(k); if ((state.params.frame > 0) !== shown) buildFramePanel(onChange); }));
  if (!shown) return;
  for (const k of ['framePlate', 'frameRub', 'frameSplat', 'frameStain', 'frameShift']) box.append(slider({ k, min: 0, max: 100 }, onChange));
  box.append(slider({ k: 'framePlateN', min: 1, max: 3 }, onChange));
  const auto = !/^#[0-9a-f]{6}$/i.test(p.frameColor || ''), row = document.createElement('div'); row.className = 'color-row field';
  const lab = document.createElement('label'), inp = document.createElement('input'); inp.type = 'color'; inp.value = auto ? getPreset(p).paper : p.frameColor;
  inp.addEventListener('input', () => { state.params.frameColor = inp.value; onChange('frameColor'); }); inp.addEventListener('change', () => { saveSettings(); buildFramePanel(onChange); });
  lab.append(t('p.frameColor') + (auto ? ' (' + t('fr.auto.on') + ')' : ''), inp);
  const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'btn btn-small'; ab.textContent = t('fr.auto'); ab.disabled = auto; ab.addEventListener('click', () => { state.params.frameColor = ''; saveSettings(); onChange('frameColor'); buildFramePanel(onChange); });
  const rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn btn-small'; rb.textContent = t('fr.reseed'); rb.addEventListener('click', () => { state.params.frameSeed = (Math.random() * 1e6) | 0; saveSettings(); onChange('frameSeed'); });
  row.append(lab, ab); const row2 = document.createElement('div'); row2.className = 'retake-row'; row2.append(rb); box.append(row, row2);
}
