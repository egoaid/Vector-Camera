// ui-hub.js - the photo-entry hub. It is the start screen (#screen-start) AND the destination of the footer "Photo" button,
// so both entry points share one screen with the same four paths: take a photo, choose an image, shoot several photos
// for a collage, choose several images for a collage. Entering the hub never starts the camera.
import { showScreen } from './ui-views.js';
const $ = (id) => document.getElementById(id);

/**
 * hooks: { hasSession(): bool - an edit session (result) exists, camera(mode, append), choose(), collageCamera(), collageChoose(), resume() }
 * Returns { show(), refresh() }.
 */
export function initHub(hooks) {
  const refresh = () => {
    const has = !!hooks.hasSession();
    $('btn-hub-back').hidden = !has; $('hub-note').hidden = !has; $('screen-start').classList.toggle('has-session', has);
  };
  const show = () => { showScreen('start'); refresh(); };
  document.addEventListener('vc:screen', (e) => { if (e.detail === 'start') refresh(); }); // whichever code shows the start screen, the hub reflects the session
  $('btn-camera').addEventListener('click', () => hooks.camera('single'));
  $('btn-choose').addEventListener('click', () => hooks.choose());
  $('btn-collage-cam').addEventListener('click', () => hooks.collageCamera());
  $('btn-collage').addEventListener('click', () => hooks.collageChoose());
  $('btn-hub-back').addEventListener('click', () => hooks.resume());
  // the brand link used to reload the page (discarding the edit); it now opens the hub
  document.querySelector('.brand').addEventListener('click', (e) => { e.preventDefault(); show(); });
  return { show, refresh };
}
