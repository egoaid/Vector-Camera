// ui-camera.js - in-app camera screen: single shot or multi-shot (collage) mode with self-timer, burst (count + interval)
// and a tray of thumbnails where unwanted shots can be deleted before continuing.
import * as cam from './camera.js';
import { t } from './i18n.js';
import { showScreen, showError } from './ui-views.js';
const $ = (id) => document.getElementById(id);
const MAX_SHOTS = 12;

export function initCameraUI({ onSingle, onMulti, back, toast }) {
  let mode = 'single', timerSecs = 0, burst = 1, gap = 1, countTimer = null, burstTimer = null, shots = [], appendTo = false, busy = false;
  const setGroup = (attr, v) => document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset[attr] === +v)));
  const flash = () => { const f = $('camera-flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };
  const stopTimers = () => { clearInterval(countTimer); clearTimeout(burstTimer); countTimer = burstTimer = null; busy = false; $('camera-count').hidden = true; $('btn-shutter').classList.remove('counting'); };
  const thumb = (cv) => { const c = document.createElement('canvas'), k = 120 / Math.max(cv.width, cv.height); c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7); };
  function renderTray(newest = false) {
    const tray = $('cam-tray'); tray.replaceChildren();
    shots.forEach((s, i) => {
      const d = document.createElement('div'); d.className = 'cam-thumb' + (newest && i === shots.length - 1 ? ' new' : ''); const im = document.createElement('img'); im.src = s.url; im.alt = '#' + (i + 1);
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', t('cam.delete')); x.addEventListener('click', () => { shots.splice(i, 1); renderTray(); sync(); });
      d.append(im, x); tray.append(d);
    });
    tray.scrollLeft = tray.scrollWidth; sync();
  }
  function sync() { const multi = mode === 'multi'; $('camera-multi').hidden = !multi; $('btn-cam-done').hidden = !multi; $('cam-spacer').hidden = multi; $('btn-cam-done').textContent = t('cam.done') + (shots.length ? ` (${shots.length})` : ''); $('btn-cam-done').disabled = multi && !shots.length; }
  function capture() { flash(); const cv = cam.capture($('video')); if (mode === 'single') { stopTimers(); cam.stop(); onSingle(cv); return false; } shots.push({ cv, url: thumb(cv) }); renderTray(true); return true; }
  function runBurst(i) {
    if (!capture()) return;
    if (i + 1 >= burst || shots.length >= MAX_SHOTS) { if (shots.length >= MAX_SHOTS) toast(t('cam.max', { n: MAX_SHOTS })); return stopTimers(); }
    burstTimer = setTimeout(() => runBurst(i + 1), gap * 1000);
  }
  function onShutter() {
    if (countTimer || burstTimer) return stopTimers();
    if (mode === 'multi' && shots.length >= MAX_SHOTS) return toast(t('cam.max', { n: MAX_SHOTS }));
    const go = () => { if (mode === 'single') return capture(); $('camera-count').hidden = true; busy = true; $('btn-shutter').classList.add('counting'); runBurst(0); };
    if (!timerSecs) return go();
    let n = timerSecs; const el = $('camera-count'); $('btn-shutter').classList.add('counting'); el.hidden = false; el.textContent = n;
    countTimer = setInterval(() => { n--; if (n <= 0) { clearInterval(countTimer); countTimer = null; el.hidden = true; go(); } else el.textContent = n; }, 1000);
  }
  async function open(m = 'single', append = false) {
    mode = m; appendTo = append; shots = []; stopTimers(); $('screen-camera').dataset.mode = m; showError('start-error', '');
    if (!cam.isSupported()) { showError('start-error', t('camera.unsupported')); return false; }
    showScreen('camera'); showError('camera-error', ''); renderTray();
    try { await cam.start($('video')); return true; } catch (e) { cam.stop(); showScreen('start'); showError('start-error', t(cam.errorKey(e))); return false; }
  }
  function close(force = false) {
    if (!force && mode === 'multi' && shots.length && !confirm(t('cam.discard'))) return;
    stopTimers(); cam.stop(); shots = []; back();
  }
  // wiring
  document.querySelectorAll('[data-timer]').forEach((b) => b.addEventListener('click', () => { timerSecs = +b.dataset.timer; setGroup('timer', timerSecs); }));
  document.querySelectorAll('[data-burst]').forEach((b) => b.addEventListener('click', () => { burst = +b.dataset.burst; setGroup('burst', burst); }));
  document.querySelectorAll('[data-gap]').forEach((b) => b.addEventListener('click', () => { gap = +b.dataset.gap; setGroup('gap', gap); }));
  setGroup('timer', timerSecs); setGroup('burst', burst); setGroup('gap', gap);
  $('btn-shutter').addEventListener('click', onShutter);
  $('btn-cam-close').addEventListener('click', () => close());
  $('btn-cam-switch').addEventListener('click', async () => { stopTimers(); try { await cam.start($('video'), true); } catch (e) { showError('camera-error', t(cam.errorKey(e))); } });
  $('btn-cam-done').addEventListener('click', () => { if (!shots.length) return; stopTimers(); const list = shots.map((s) => s.cv); cam.stop(); shots = []; onMulti(list, appendTo); });
  const onOrient = () => { if ($('screen-camera').classList.contains('active') && !countTimer && !burstTimer && !cam.rotation) { const v = $('video'); const vp = v.videoHeight > v.videoWidth; if (v.videoWidth && vp !== cam.isPortrait()) cam.start(v).catch(() => {}); } };
  let rz = 0; window.addEventListener('orientationchange', () => setTimeout(onOrient, 350)); window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(onOrient, 450); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('screen-camera').classList.contains('active')) { stopTimers(); cam.stop(); if (mode === 'multi' && shots.length) { /* keep shots; user returns to a stopped camera */ close(true); } else close(true); } });
  return { open, close, isOpen: () => $('screen-camera').classList.contains('active') };
}
