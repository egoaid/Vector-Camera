// ui-works.js - the Works lists: the "Works" page of the edit sheet and the list on the start screen.
// Tapping a work opens it to keep editing; each work can be deleted on its own.
import { t, getLang } from './i18n.js';
import { WORKS_AVAILABLE, listWorks, removeWork, clearWorks } from './works-db.js';
const $ = (id) => document.getElementById(id);
const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>';

export const workDate = (ms, lang = getLang()) => new Date(ms).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const workLabel = (rec) => [t('mode.' + rec.mode), rec.kind === 'collage' ? t('works.collage', { n: rec.n }) : t('works.single')].join(' · ');

/** hooks: { currentId(): id of the work being edited, open(id), deleted(id, wasCurrent), toast(msg) } */
export function initWorks(hooks) {
  let urls = [], seq = 0;
  const hosts = () => [$('works-list'), $('works-home-list')];
  function card(rec, cur) {
    const el = document.createElement('div'); el.className = 'work';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'work-open'; open.title = t('works.open');
    const img = document.createElement('img'); img.className = 'work-thumb'; img.alt = ''; img.decoding = 'async';
    if (rec.thumb) { const u = URL.createObjectURL(rec.thumb); urls.push(u); img.src = u; }
    const meta = document.createElement('span'); meta.className = 'work-meta';
    const b = document.createElement('b'); b.textContent = workDate(rec.updated); const s = document.createElement('span'); s.textContent = workLabel(rec);
    meta.append(b, s); open.append(img, meta); open.addEventListener('click', () => hooks.open(rec.id)); el.appendChild(open);
    if (cur) { const badge = document.createElement('span'); badge.className = 'work-badge'; badge.textContent = t('works.current'); el.appendChild(badge); }
    const del = document.createElement('button'); del.type = 'button'; del.className = 'work-del'; del.title = t('works.delete'); del.setAttribute('aria-label', t('works.delete')); del.innerHTML = TRASH;
    del.addEventListener('click', async (e) => {
      e.stopPropagation(); if (!window.confirm(t('works.delete.confirm'))) return;
      try { await removeWork(rec.id); } catch (err) { console.error(err); return; }
      const was = hooks.currentId() === rec.id; hooks.deleted(rec.id, was); hooks.toast(t(was ? 'works.deleted.current' : 'works.deleted')); refresh();
    });
    el.appendChild(del); return el;
  }
  async function refresh() {
    const my = ++seq, [sheetHost, homeHost] = hosts();
    let list = []; if (WORKS_AVAILABLE) { try { list = await listWorks(); } catch (err) { console.error(err); list = []; } }
    if (my !== seq) return;
    for (const u of urls) URL.revokeObjectURL(u); urls = [];
    const cur = hooks.currentId();
    for (const host of [sheetHost, homeHost]) {
      if (!host) continue; host.replaceChildren();
      for (const rec of list) host.appendChild(card(rec, rec.id === cur));
    }
    for (const host of [sheetHost, homeHost]) if (host) { host.parentNode.querySelector('.works-clear')?.remove(); if (list.length) host.after(clearButton(list.length)); }
    if (sheetHost && !list.length) { const p = document.createElement('p'); p.className = 'note works-empty'; p.textContent = t(WORKS_AVAILABLE ? 'works.empty' : 'works.unavailable'); sheetHost.appendChild(p); }
    const homePanel = $('works-home'); if (homePanel) homePanel.hidden = !list.length;
  }
  function clearButton(n) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary btn-small works-clear'; b.textContent = `${t('works.clear')} (${t('works.count', { n })})`;
    b.addEventListener('click', async () => {
      if (!window.confirm(t('works.clear.confirm', { n }))) return;
      try { await clearWorks(); } catch (err) { console.error(err); return; }
      const was = !!hooks.currentId(); hooks.deleted(null, was); hooks.toast(t('works.deleted')); refresh();
    });
    return b;
  }
  document.addEventListener('vc:page', (e) => { if (e.detail === 'works') refresh(); });
  document.addEventListener('vc:screen', (e) => { if (e.detail === 'start') refresh(); });
  document.addEventListener('vc:lang', refresh);
  refresh();
  return { refresh };
}
