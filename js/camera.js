// camera.js - getUserMedia wrapper. Permission is requested ONLY when the user taps the camera button.
// Orientation: the requested resolution follows the screen orientation (portrait -> tall, landscape -> wide),
// and the stream is restarted when the device is rotated. The captured frame is whatever the video delivers
// (what you see is what you get; EXIF is not involved because frames come from the video element).
let stream = null, facing = 'environment';
export const isSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const isPortrait = () => (window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : innerHeight >= innerWidth);
export function constraints(portrait, face) {
  const long = { ideal: 1920 }, short = { ideal: 1080 };
  return { audio: false, video: { facingMode: { ideal: face }, width: portrait ? short : long, height: portrait ? long : short } };
}
export async function start(video, flip = false) {
  stop(); if (flip) facing = facing === 'environment' ? 'user' : 'environment';
  try { stream = await navigator.mediaDevices.getUserMedia(constraints(isPortrait(), facing)); }
  catch (e) { if (e && e.name === 'OverconstrainedError') stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing } } }); else throw e; }
  video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
  return facing;
}
export function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
export const facingMode = () => facing;
export function capture(video) {
  const cv = document.createElement('canvas'); cv.width = video.videoWidth; cv.height = video.videoHeight;
  const c = cv.getContext('2d');
  if (facing === 'user') { /* keep the saved photo un-mirrored (the preview is not mirrored either) */ }
  c.drawImage(video, 0, 0); return cv;
}
/** Maps getUserMedia errors to i18n keys. */
export function errorKey(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'camera.denied';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'camera.notfound';
  if (n === 'NotReadableError') return 'camera.busy';
  return 'camera.error';
}
