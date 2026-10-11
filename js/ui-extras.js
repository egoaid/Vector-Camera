// ui-extras.js - panels added in v0.2: randomise options, contour lines, vector text, collage layout.
import { t } from './i18n.js';
import { state, saveSettings } from './state.js';
import { slider, select, check } from './ui-controls.js';
import { FONTS, ensureFont, isLatinOnly } from './style-text.js';
import { LAYOUTS, ASPECTS } from './style-collage.js';
const $ = (id) => document.getElementById(id);

function colorInput(key, labelKey, onChange) {
  const l = document.createElement('label'), i = document.createElement('input'); i.type = 'color'; i.value = state.params[key] || '#ffffff';
  i.addEventListener('input', () => { state.params[key] = i.value; onChange(key); }); i.addEventListener('change', saveSettings); l.append(t(labelKey), i); return l;
}
const colorRow = (...items) => { const r = document.createElement('div'); r.className = 'color-row'; r.append(...items); return r; };
const sl = (k, min, max, onChange) => slider({ k, min, max }, onChange);

export function buildExtras(onChange, hooks) {
  // --- randomise options
  const ro = $('random-opts'); ro.replaceChildren();
  for (const k of ['palette', 'texture', 'background', 'subject', 'lines', 'font']) {
    const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!state.params.rndOpts[k];
    const s = document.createElement('span'); s.textContent = t('rnd.o.' + k); i.addEventListener('change', () => { state.params.rndOpts[k] = i.checked; saveSettings(); }); l.append(i, s); ro.append(l);
  }
  // --- contour lines
  const ln = $('lines-ctl'); ln.replaceChildren();
  ln.append(sl('lineWidth', 0, 100, onChange), select('lineScope', [['mid', 'ln.scope.mid'], ['fg', 'ln.scope.fg'], ['all', 'ln.scope.all']], onChange, 'ln.scope'), sl('lineOffset', 0, 100, onChange), colorRow(colorInput('lineColor', 'ln.color', onChange), colorInput('lineColor2', 'ln.color2', onChange)));
  // --- text
  const tx = $('text-ctl'); tx.replaceChildren();
  const f = document.createElement('div'); f.className = 'field'; const lab = document.createElement('label'); lab.htmlFor = 'in-text'; lab.textContent = t('tx.text');
  const ta = document.createElement('textarea'); ta.id = 'in-text'; ta.rows = 2; ta.maxLength = 80; ta.value = state.params.text; ta.placeholder = 'HEY BOY\nHEY GIRL';
  const warn = document.createElement('p'); warn.className = 'note'; warn.hidden = true; warn.textContent = t('tx.latin');
  ta.addEventListener('input', () => { state.params.text = ta.value; warn.hidden = isLatinOnly(ta.value); onChange('text'); }); ta.addEventListener('change', saveSettings);
  f.append(lab, ta, warn);
  const fontSel = document.createElement('div'); fontSel.className = 'field'; const fl = document.createElement('label'); fl.htmlFor = 'se-textFont'; fl.textContent = t('tx.font');
  const fs = document.createElement('select'); fs.id = 'se-textFont'; for (const d of FONTS) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; fs.append(o); }
  fs.value = state.params.textFont; fs.addEventListener('change', async () => { state.params.textFont = fs.value; saveSettings(); await ensureFont(fs.value); onChange('textFont'); }); fontSel.append(fl, fs);
  tx.append(f, fontSel, sl('textSize', 4, 60, onChange), sl('textX', 0, 100, onChange), sl('textY', 0, 100, onChange), sl('textAngle', -45, 45, onChange), sl('textSpacing', -5, 30, onChange), sl('textShadow', 0, 100, onChange),
    colorRow(colorInput('textColor', 'tx.color', onChange), colorInput('textShadowColor', 'tx.shadowcolor', onChange)));
  // --- collage
  const cc = $('collage-ctl'); cc.replaceChildren();
  cc.append(select('collageLayout', LAYOUTS.map((l) => [l, 'col.l.' + l]), onChange, 'col.layout'), select('collageAspect', Object.keys(ASPECTS).map((a) => [a, 'col.a.' + a]), onChange, 'col.aspect'),
    sl('collageSlots', 0, 16, onChange), sl('collageTorn', 0, 100, onChange), sl('collageGap', 0, 100, onChange), sl('collageRotate', 0, 100, onChange), check('collageVary', 'col.vary', onChange),
    colorRow(colorInput('collagePaper', 'col.paper', onChange)));
  const row = document.createElement('div'); row.className = 'retake-row';
  const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn btn-small'; b1.textContent = t('col.shuffle'); b1.addEventListener('click', hooks.shuffle);
  const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn btn-small'; b2.textContent = t('col.add'); b2.addEventListener('click', hooks.add);
  row.append(b1, b2); cc.append(row);
  $('sec-collage').hidden = !state.collage;
}
