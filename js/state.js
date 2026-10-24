// state.js - app state, persisted settings and a minimal event bus.
import { DEFAULT_PARAMS, MODE_DEFAULTS } from './config.js';
import { SETTINGS_SCHEMA } from './version.js';
const KEY = 'vc.settings.v' + SETTINGS_SCHEMA;
export const state = { params: { ...DEFAULT_PARAMS, silColors: { ...DEFAULT_PARAMS.silColors } }, source: null, canvas: null, work: null, result: null, groups: null, scene: null, overrides: [], workId: null, blob: null, engineUsed: 'classic', sem: null, busy: false, seq: 0, textSlot: 0 };
/** Merges saved parameters onto the defaults (new parameters get their defaults, nested groups are merged). keepMode: a saved work restores its mode; the app-wide settings do not. */
export function mergeParams(s, { keepMode = false } = {}) {
  const keep = { ...s }; if (!keepMode) delete keep.mode;
  const p = { ...DEFAULT_PARAMS, ...keep, silColors: { ...DEFAULT_PARAMS.silColors, ...(s.silColors || {}) }, rndOpts: { ...DEFAULT_PARAMS.rndOpts, ...(s.rndOpts || {}) }, lock: { ...DEFAULT_PARAMS.lock, ...(s.lock || {}) } };
  if (p.faceEngine !== 'off') p.faceEngine = 'modern'; delete p.engineProfiles; return p;
}
export function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state.params = mergeParams({ ...state.params, ...s }); } catch { /* ignore */ }
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(state.params)); } catch { /* ignore */ } }
export function applyModeDefaults(mode) { state.params = { ...state.params, ...MODE_DEFAULTS[mode], mode }; }
const bus = new EventTarget();
export const on = (ev, fn) => bus.addEventListener(ev, (e) => fn(e.detail));
export const emit = (ev, detail) => bus.dispatchEvent(new CustomEvent(ev, { detail }));
