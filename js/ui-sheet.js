// ui-sheet.js - bottom toolbar (icons) + edit sheet, in the manner of photo-editor apps: tapping an icon opens that
// tool's page above the toolbar (phones) or in the side column (desktop); the export icon sits at the right end.
import { t } from './i18n.js';
const $ = (id) => document.getElementById(id);
export function initSheet() {
  const sheet = $('sheet'), bar = $('toolbar'), btns = [...bar.querySelectorAll('.tb-btn')], pages = [...sheet.querySelectorAll('.page')];
  const desk = () => window.matchMedia('(min-width: 900px)').matches;
  let page = 'style', open = desk();
  function apply() {
    if (page === 'compose' && $('sec-collage').hidden) page = 'style';
    pages.forEach((p) => p.classList.toggle('on', p.dataset.page === page));
    btns.forEach((b) => b.setAttribute('aria-pressed', String(open && b.dataset.tool === page)));
    sheet.classList.toggle('open', open || desk()); document.body.classList.toggle('sheet-open', open && !desk()); sheet.dataset.page = page;
    $('sheet-title').textContent = t('tb.' + page);
  }
  for (const b of btns) b.addEventListener('click', () => { if (b.dataset.tool === page && open && !desk()) open = false; else { page = b.dataset.tool; open = true; } apply(); });
  $('sheet-close').addEventListener('click', () => { open = false; apply(); });
  window.addEventListener('resize', apply); document.addEventListener('vc:sheet', apply); document.addEventListener('vc:lang', apply);
  apply();
  return { show: (p) => { page = p; open = true; apply(); } };
}
