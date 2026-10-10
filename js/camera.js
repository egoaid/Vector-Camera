// camera.js - getUserMedia wrapper. Permission is requested ONLY when the user taps the camera button.
let stream = null, facing = 'environment';
export const isSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export async function start(video, flip = false) {
  stop(); if (flip) facing = facing === 'environment' ? 'user' : 'environment';
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
  video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
  return facing;
}
export function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
export function capture(video) {
  const cv = document.createElement('canvas'); cv.width = video.videoWidth; cv.height = video.videoHeight;
  cv.getContext('2d').drawImage(video, 0, 0); return cv;
}
/** Maps getUserMedia errors to i18n keys. */
export function errorKey(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'camera.denied';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'camera.notfound';
  if (n === 'NotReadableError') return 'camera.busy';
  return 'camera.error';
}
