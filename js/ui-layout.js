// ui-layout.js - phone layout helpers: measures the preview area (--area-w / --area-h, so the frame can fill it exactly,
// also when the edit sheet opens) and drives the header "..." menu (retake / choose / compare / fix / re-analyse).
const $ = (id) => document.getElementById(id);
export function initLayout() {
  const col = $('stage-col'), stage = $('stage'), more = $('btn-more'), menu = $('stage-menu');
  const measure = () => { stage.style.setProperty('--area-w', col.clientWidth + 'px'); stage.style.setProperty('--area-h', col.clientHeight + 'px'); };
  new ResizeObserver(measure).observe(col); measure();
  const setMenu = (on) => { document.body.classList.toggle('menu-open', on); more.setAttribute('aria-expanded', String(on)); };
  more.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', (e) => { if (e.target.closest('button')) setMenu(false); });
  document.addEventListener('click', (e) => { if (document.body.classList.contains('menu-open') && !e.target.closest('#stage-menu')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
}
