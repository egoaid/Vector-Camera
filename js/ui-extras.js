// ui-extras.js - panels added in v0.2: randomise options, contour lines, vector text, collage layout.
import { t } from './i18n.js';
import { TENDENCIES } from './style-tendency.js';
import { state, saveSettings } from './state.js';
import { slider, select, check } from './ui-controls.js';
import { FONTS, ensureFont, isLatinOnly } from './style-text.js';
import { TEXT_SLOTS, tkey, INK_MODES } from './config.js';
import { HT_TYPES } from './halftone-types.js';
import { getPreset } from './style-palette.js';
import { LAYOUTS, ASPECTS, EDGES } from './style-collage.js';
const $ = (id) => document.getElementById(id);

export function colorInput(key, labelKey, onChange) {
  const l = document.createElement('label'), i = document.createElement('input'); i.type = 'color'; i.value = state.params[key] || '#ffffff';
  i.addEventListener('input', () => { state.params[key] = i.value; onChange(key); }); i.addEventListener('change', saveSettings); l.append(t(labelKey), i); return l;
}
export const colorRow = (...items) => { const r = document.createElement('div'); r.className = 'color-row'; r.append(...items); return r; };
const sl = (k, min, max, onChange, base) => slider({ k, min, max, base }, onChange);

export function buildExtras(onChange, hooks) {
  // --- randomise options
  const rs = $('sel-rnd-style'); if (rs) { rs.replaceChildren(); for (const k of ['off', ...TENDENCIES]) { const o = document.createElement('option'); o.value = k; o.textContent = t('rnd.tend.' + k); rs.append(o); } rs.value = state.params.rndStyle || 'off'; rs.onchange = () => { state.params.rndStyle = rs.value; saveSettings(); }; }
  renderRandomLock();
  const ro = $('random-opts'); ro.replaceChildren();
  for (const k of ['palette', 'shape', 'texture', 'background', 'subject', 'lines', 'collage', 'aspect', 'textOn', 'font', 'textFx']) {
    const l = document.createElement('label'); l.className = 'check'; const i = document.createElement('input'); i.type = 'checkbox'; i.checked = state.params.rndOpts[k] ?? (k === 'shape'); // the shape option is new: on for settings saved before it existed
    const s = document.createElement('span'); s.textContent = t('rnd.o.' + k); i.addEventListener('change', () => { state.params.rndOpts[k] = i.checked; saveSettings(); }); l.append(i, s); ro.append(l);
  }
  // --- colour tab: halftone colour, line colours, collage paper and the colour locks (palette chips are built in ui-controls)
  buildColorPanel(onChange);
  // --- contour lines
  const ln = $('lines-ctl'); ln.replaceChildren();
  ln.append(sl('lineWidth', 0, 100, onChange), select('lineScope', [['mid', 'ln.scope.mid'], ['fg', 'ln.scope.fg'], ['all', 'ln.scope.all']], onChange, 'ln.scope'), sl('lineOffset', 0, 100, onChange));
  // --- text (3 slots; each has its own wording, font, size, position, tilt, colours and print effects)
  buildTextPanel(onChange);
  // --- collage
  const cc = $('collage-ctl'); cc.replaceChildren();
  cc.append(select('collageLayout', LAYOUTS.map((l) => [l, 'col.l.' + l]), onChange, 'col.layout'), select('collageEdge', EDGES.map((e) => [e, 'col.e.' + e]), onChange, 'col.edge'), select('collageAspect', Object.keys(ASPECTS).map((a) => [a, 'col.a.' + a]), onChange, 'col.aspect'),
    sl('collageSlots', 0, 16, onChange), sl('collageTorn', 0, 100, onChange), sl('collageGap', 0, 100, onChange), sl('collageRotate', 0, 100, onChange), check('collageVary', 'col.vary', onChange));
  const row = document.createElement('div'); row.className = 'retake-row';
  const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn btn-small'; b1.textContent = t('col.shuffle'); b1.addEventListener('click', hooks.shuffle);
  const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn btn-small'; b2.textContent = t('col.add'); b2.addEventListener('click', hooks.add);
  const b3 = document.createElement('button'); b3.type = 'button'; b3.className = 'btn btn-small'; b3.textContent = t('col.addcam'); b3.addEventListener('click', hooks.addCam);
  row.append(b1, b2, b3); cc.append(row);
  $('sec-collage').hidden = !state.collage; $('tb-compose').hidden = !state.collage; document.dispatchEvent(new CustomEvent('vc:sheet'));
}

/** One line under the Random button: which colours stay locked (the Colour tab locks) and that everything else may change. */
export function renderRandomLock() {
  const el = $('rnd-lock'); if (!el) return; const lk = state.params.lock || {}, on = [['palette', 'color.lock.palette'], ['htColor', 'color.lock.ht'], ['lineColor', 'color.lock.line']].filter(([g]) => lk[g]).map(([, k]) => t(k));
  el.textContent = on.length ? t('rnd.locked', { groups: on.join(' / ') }) : t('rnd.unlocked');
}
let rebuildTextCb = null;
/** Rebuilds the text panel (e.g. after a handle drag changed values). */
export function rebuildText() { if (rebuildTextCb) rebuildTextCb(); }
export function buildTextPanel(onChange) {
  rebuildTextCb = () => buildTextPanel(onChange);
  const tx = $('text-ctl'); tx.replaceChildren();
  const i = Math.max(0, Math.min(TEXT_SLOTS - 1, state.textSlot | 0)), K = (k) => tkey(k, i);
  const tabs = document.createElement('div'); tabs.className = 'tx-tabs'; tabs.setAttribute('role', 'tablist');
  for (let n = 0; n < TEXT_SLOTS; n++) {
    const shown = !!state.params[tkey('textShow', n)], txt = String(state.params[tkey('text', n)] || '').trim(), sel = n === i;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tx-tab' + (shown ? ' shown' : ''); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(sel)); b.dataset.slot = String(n + 1);
    const num = document.createElement('span'); num.className = 'tx-num'; num.textContent = String(n + 1);
    const name = document.createElement('span'); name.className = 'tx-name'; name.textContent = txt || t('tx.empty');
    const st = document.createElement('span'); st.className = 'tx-state'; st.textContent = t(shown ? 'tx.on' : 'tx.off');
    b.append(num, name, st); b.setAttribute('aria-label', t('tx.slot', { n: n + 1 }) + ' ' + t(shown ? 'tx.on' : 'tx.off'));
    b.addEventListener('click', () => { state.textSlot = n; buildTextPanel(onChange); onChange('textSlot'); }); tabs.append(b);
  }
  const f = document.createElement('div'); f.className = 'field'; const lab = document.createElement('label'); lab.htmlFor = 'in-text'; lab.textContent = t('tx.text');
  const ta = document.createElement('textarea'); ta.id = 'in-text'; ta.rows = 2; ta.maxLength = 80; ta.value = state.params[K('text')] || ''; ta.placeholder = 'Vector Camera';
  const warn = document.createElement('p'); warn.className = 'note'; warn.hidden = true; warn.textContent = t('tx.latin');
  ta.addEventListener('input', () => { state.params[K('text')] = ta.value; warn.hidden = isLatinOnly(ta.value); onChange(K('text')); }); ta.addEventListener('change', saveSettings);
  f.append(lab, ta, warn);
  const fontSel = document.createElement('div'); fontSel.className = 'field'; const fl = document.createElement('label'); fl.htmlFor = 'se-textFont'; fl.textContent = t('tx.font');
  const fs = document.createElement('select'); fs.id = 'se-textFont'; for (const cat of ['display', 'hand', 'type']) { const og = document.createElement('optgroup'); og.label = t('tx.cat.' + cat); for (const d of FONTS.filter((x) => x.cat === cat)) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; og.append(o); } fs.append(og); }
  fs.value = state.params[K('textFont')]; fs.addEventListener('change', async () => { state.params[K('textFont')] = fs.value; saveSettings(); await ensureFont(fs.value); onChange(K('textFont')); }); fontSel.append(fl, fs);
  const S = (b, min, max) => sl(K(b), min, max, onChange, b);
  const showCb = check(K('textShow'), 'tx.show', (k) => { onChange(k); buildTextPanel(onChange); });
  tx.append(tabs, showCb, f, fontSel, S('textSize', 4, 60), S('textX', 0, 100), S('textY', 0, 100), S('textAngle', -90, 90), S('textSpacing', -5, 30), S('textShadow', 0, 100),
    S('textHalftone', 0, 100), select(K('textHalftoneType'), HT_TYPES.map((x) => [x, 'ht.' + x]), onChange, 'p.htype'), S('textHalftoneSize', 2, 14), S('textHalftoneAngle', 0, 90),
    select(K('textHalftoneMode'), [['down', 'tx.ht.down'], ['up', 'tx.ht.up'], ['right', 'tx.ht.right'], ['flat', 'tx.ht.flat']], onChange, 'tx.ht.mode'), S('textWear', 0, 100), S('textDirt', 0, 100));
  const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'btn btn-small'; rs.textContent = t('tx.reseed'); rs.addEventListener('click', () => { state.params[K('textSeed')] = (Math.random() * 1e6) | 0; saveSettings(); onChange(K('textSeed')); }); tx.append(rs);
  const hint = document.createElement('p'); hint.className = 'note'; hint.textContent = t('tx.drag.hint'); tx.append(hint);
}

/** Colour tab: palette chips live in #presets (ui-controls); here the colour overrides and the colour locks. */
function buildColorPanel(onChange) {
  const box = $('color-ctl'); if (!box) return; box.replaceChildren(); const p = state.params, again = (k) => { onChange(k); buildColorPanel(onChange); };
  const lockBox = (group, labelKey) => { const l = document.createElement('label'), i = document.createElement('input'), s = document.createElement('span'); l.className = 'check lock'; i.type = 'checkbox'; i.checked = !!(p.lock && p.lock[group]); s.textContent = '🔒 ' + t(labelKey); i.addEventListener('change', () => { state.params.lock = { ...state.params.lock, [group]: i.checked }; saveSettings(); onChange('lock'); }); l.append(i, s); return l; };
  const htOn = INK_MODES.includes(p.mode) && p.halftone > 0, auto = p.htColor === '' || p.htColor == null;
  const h = document.createElement('div'); h.className = 'field'; // halftone colour (follows the palette until set)
  const hl = document.createElement('label'), hi = document.createElement('input'); hi.type = 'color'; hi.disabled = !htOn;
  const pr = getPreset(p); hi.value = auto ? (pr.mode === 'bands' ? (pr.groups.fg.ramp && pr.groups.fg.ramp[0]) || pr.ink : pr.ink) : p.htColor;
  hi.addEventListener('input', () => { state.params.htColor = hi.value; onChange('htColor'); }); hi.addEventListener('change', () => { saveSettings(); buildColorPanel(onChange); });
  hl.append(t('p.htColor') + (auto ? ' (' + t('ht.color.autoon') + ')' : ''), hi);
  const hb = document.createElement('button'); hb.type = 'button'; hb.className = 'btn btn-small'; hb.textContent = t('ht.color.auto'); hb.disabled = auto || !htOn; hb.addEventListener('click', () => { state.params.htColor = ''; again('htColor'); });
  h.append(colorRow(hl, hb)); if (!htOn) { const n = document.createElement('p'); n.className = 'note'; n.textContent = t('color.ht.off'); h.append(n); }
  const ln = document.createElement('div'); ln.className = 'field'; ln.append(colorRow(colorInput('lineColor', 'ln.color', onChange), colorInput('lineColor2', 'ln.color2', onChange)));
  const lk = document.createElement('div'); lk.className = 'field';
  const title = document.createElement('span'); title.className = 'label'; title.textContent = t('color.lock.title'); const note = document.createElement('p'); note.className = 'note'; note.textContent = t('color.lock.note');
  const list = document.createElement('div'); list.className = 'lock-list'; list.append(lockBox('palette', 'color.lock.palette'), lockBox('htColor', 'color.lock.ht'), lockBox('lineColor', 'color.lock.line')); lk.append(title, note, list);
  box.append(h, ln); if (state.collage) { const c = document.createElement('div'); c.className = 'field'; c.append(colorRow(colorInput('collagePaper', 'col.paper', onChange))); box.append(c); } box.append(lk);
}
