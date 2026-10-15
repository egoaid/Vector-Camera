// ui-styles.js - the style library on the Style page: built-in styles, my styles (save / overwrite / rename / delete) and JSON export / import.
import { t } from './i18n.js';
import { state } from './state.js';
import { toast } from './ui-toast.js';
import { download, stamp } from './export-files.js';
import { BUILTIN_STYLES, applyBuiltin, isBuiltinActive, snapshotStyle, applyUser, isUserActive, lockConflicts, loadUserStyles, saveUserStyles, newId, cleanName, uniqueName, MAX_USER_STYLES, styleToJSON, parseStyleJSON } from './style-presets.js';
const $ = (id) => document.getElementById(id);
let users = [], selId = null, hooks = null;

/** Opens the name dialog. mode 'name' asks for text (resolves to the text or null); mode 'confirm' asks yes / no. */
function askDialog({ title, msg, value, confirm }) {
  return new Promise((resolve) => {
    const dlg = $('dlg-name'), inp = $('inp-name'), form = $('form-name'); let done = false;
    $('name-title').textContent = title; const m = $('name-msg'); m.hidden = !msg; m.textContent = msg || ''; inp.hidden = !!confirm; inp.value = value || ''; inp.placeholder = t('st.name.ph');
    const finish = (v) => { if (done) return; done = true; form.removeEventListener('submit', ok); $('name-cancel').removeEventListener('click', no); dlg.removeEventListener('close', onClose); if (dlg.open) dlg.close(); resolve(v); };
    const ok = (e) => { e.preventDefault(); finish(confirm ? true : cleanName(inp.value) || null); }, no = () => finish(confirm ? false : null), onClose = () => finish(confirm ? false : null);
    form.addEventListener('submit', ok); $('name-cancel').addEventListener('click', no); dlg.addEventListener('close', onClose);
    dlg.showModal(); if (!confirm) { inp.focus(); inp.select(); }
  });
}
const persist = () => { if (!saveUserStyles(users)) toast(t('st.nostore')); };
const btn = (label, cls, fn, disabled) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small ' + (cls || ''); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
const chip = (label, pressed, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip style-chip'; b.textContent = label; b.setAttribute('aria-pressed', String(pressed)); b.addEventListener('click', fn); return b; };
const sel = () => users.find((s) => s.id === selId) || null;
/** Restores a My Style exactly; if a colour lock kept different colours, say so (the only intended difference). */
function restore(s) {
  selId = s.id; const conflicts = lockConflicts(state.params, s);
  hooks.apply(applyUser(state.params, s), s.name, { exact: true });
  if (conflicts.length) toast(t('st.lockkept', { groups: conflicts.map((g) => t('color.lock.' + (g === 'palette' ? 'palette' : g === 'htColor' ? 'ht' : 'line'))).join(' / ') }));
}

async function saveNew() {
  if (users.length >= MAX_USER_STYLES) { toast(t('st.full')); return; }
  const name = await askDialog({ title: t('st.name.save'), value: '' }); if (!name) return;
  const s = { id: newId(), name: uniqueName(users, name), created: new Date().toISOString(), params: snapshotStyle(state.params) };
  users.push(s); selId = s.id; persist(); render(); toast(t('st.saved', { name: s.name }));
}
function overwrite() { const s = sel(); if (!s) return; s.params = snapshotStyle(state.params); persist(); render(); toast(t('st.over', { name: s.name })); }
async function rename() { const s = sel(); if (!s) return; const name = await askDialog({ title: t('st.name.rename'), value: s.name }); if (!name) return; s.name = uniqueName(users, name, s.id); persist(); render(); }
async function remove() {
  const s = sel(); if (!s) return; if (!(await askDialog({ title: t('st.del.title'), msg: t('st.del.msg', { name: s.name }), confirm: true }))) return;
  users = users.filter((x) => x.id !== s.id); selId = null; persist(); render(); toast(t('st.deleted', { name: s.name }));
}
function exportStyles(list) { if (!list.length) return; const name = list.length === 1 ? `vector-camera-style_${list[0].name.replace(/[^\w぀-ヿ㐀-鿿-]+/g, '_')}.json` : `vector-camera-styles_${stamp()}.json`; download(new Blob([styleToJSON(list)], { type: 'application/json' }), name); }
async function importFile(file) {
  let list; try { list = parseStyleJSON(await file.text()); } catch { toast(t('st.bad')); return; }
  const room = MAX_USER_STYLES - users.length; if (room <= 0) { toast(t('st.full')); return; }
  const added = []; for (const s of list.slice(0, room)) { const n = { id: newId(), name: uniqueName(users, s.name), created: s.created, params: s.params }; users.push(n); added.push(n); }
  selId = added[added.length - 1].id; persist(); render(); toast(t('st.imported', { n: added.length }));
  if (added.length === 1) restore(added[0]); // a single style is applied at once
}

function render() {
  const root = $('style-lib'); if (!root) return; root.replaceChildren();
  const lab = (k, cls) => { const p = document.createElement('span'); p.className = 'label' + (cls ? ' ' + cls : ''); p.textContent = t(k); return p; };
  const note = document.createElement('p'); note.className = 'note'; note.textContent = t('style.note');
  const bi = document.createElement('div'); bi.className = 'chips'; bi.setAttribute('role', 'group');
  for (const def of BUILTIN_STYLES) bi.append(chip(t('style.' + def.id), isBuiltinActive(state.params, def), () => { selId = null; hooks.apply(applyBuiltin(state.params, def), t('style.' + def.id)); }));
  const mine = document.createElement('div'); mine.className = 'chips'; mine.setAttribute('role', 'group');
  for (const s of users) mine.append(chip(s.name, isUserActive(state.params, s), () => restore(s)));
  if (!users.length) { const e = document.createElement('p'); e.className = 'note'; e.textContent = t('style.none'); mine.append(e); }
  for (const c of mine.querySelectorAll('.style-chip')) c.classList.toggle('picked', users.find((s) => s.name === c.textContent)?.id === selId);
  const acts = document.createElement('div'); acts.className = 'style-actions';
  const has = !!sel();
  acts.append(btn(t('st.save'), 'btn-primary', saveNew), btn(t('st.overwrite'), '', overwrite, !has), btn(t('st.rename'), '', rename, !has), btn(t('st.delete'), '', remove, !has), btn(t('st.export'), '', () => exportStyles([sel()]), !has), btn(t('st.exportall'), '', () => exportStyles(users), users.length < 2), btn(t('st.import'), '', () => $('file-style').click()));
  root.append(lab('style.title'), note, lab('style.mine', 'sub'), mine, acts, lab('style.builtin', 'sub'), bi);
}

export const buildStyleLibrary = () => render();
/** Re-highlights the active styles (call after any parameter change). */
export const refreshStyleLibrary = () => render();
export function initStyleLibrary(h) {
  hooks = h; users = loadUserStyles();
  $('file-style').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
}
