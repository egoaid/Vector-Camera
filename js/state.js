// state.js - app state, persisted settings and a minimal event bus.
import { DEFAULT_PARAMS, MODE_DEFAULTS } from './config.js';
import { SETTINGS_SCHEMA } from './version.js';
const KEY = 'vc.settings.v' + SETTINGS_SCHEMA;
export const state = { params: { ...DEFAULT_PARAMS, silColors: { ...DEFAULT_PARAMS.silColors } }, source: null, canvas: null, work: null, result: null, groups: null, scene: null, overrides: [], engineUsed: 'classic', sem: null, busy: false, seq: 0, textSlot: 0 };
export function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { const keep = { ...s }; delete keep.mode; state.params = { ...state.params, ...keep, silColors: { ...state.params.silColors, ...(s.silColors || {}) }, rndOpts: { ...state.params.rndOpts, ...(s.rndOpts || {}) } }; if (state.params.faceEngine !== 'off') state.params.faceEngine = 'modern'; delete state.params.engineProfiles; } } catch { /* ignore */ }
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(state.params)); } catch { /* ignore */ } }
export function applyModeDefaults(mode) { state.params = { ...state.params, ...MODE_DEFAULTS[mode], mode }; }
const bus = new EventTarget();
export const on = (ev, fn) => bus.addEventListener(ev, (e) => fn(e.detail));
export const emit = (ev, detail) => bus.dispatchEvent(new CustomEvent(ev, { detail }));
