// ui-tone.js - the "tone" group of the Style tab (hybrid mode): classic / silver-gelatin / strict two-tone, with the controls of the chosen tone.
import { slider, select, check } from './ui-controls.js';
import { INK_MODES } from './config.js';
import { state } from './state.js';
import { t } from './i18n.js';
const $ = (id) => document.getElementById(id);

export function buildTone(onChange, mode = state.params.mode) {
  const box = $('tone-ctl'); if (!box) return; box.replaceChildren(); const p = state.params;
  if (!INK_MODES.includes(mode)) { const n = document.createElement('p'); n.className = 'note'; n.textContent = t('tone.hybridonly'); box.append(n); return; }
  const re = (k) => { onChange(k); buildTone(onChange, mode); };
  box.append(select('tone', [['classic', 'tone.classic'], ['silver', 'tone.silver'], ['twotone', 'tone.twotone']], re, 'p.tone'));
  const n = document.createElement('p'); n.className = 'note'; n.textContent = t('tone.desc.' + (p.tone || 'classic')); box.append(n);
  const S = (k, min = 0, max = 100) => slider({ k, min, max }, onChange);
  if (p.tone === 'silver') {
    box.append(S('sgBlack'), S('sgWhite'), S('sgContrast'), S('sgCurve'), S('sgGrain'), S('sgGrainSize'), S('sgGrainRough'));
    box.append(select('sgToning', [['none', 'tone.none'], ['sepia', 'tone.sepia'], ['selenium', 'tone.selenium']], re, 'p.sgToning'));
    if (p.sgToning && p.sgToning !== 'none') box.append(S('sgToningAmt'));
  } else if (p.tone === 'twotone') {
    box.append(S('ttThreshold'), S('ttBias'), S('ttAdaptive'), S('ttDetail'), S('ttEdge'), S('ttClean'), S('ttBreakup'), check('ttStrict', 'p.ttStrict', onChange));
  }
}
