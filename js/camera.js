// camera.js - getUserMedia wrapper. Permission is requested ONLY when the user taps the camera button.
// Orientation: the requested resolution follows the screen orientation (portrait -> tall, landscape -> wide),
// and the stream is restarted when the device is rotated. The captured frame is whatever the video delivers
// (what you see is what you get; EXIF is not involved because frames come from the video element).
let stream = null, facing = 'environment';
export const isSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const isPortrait = () => (window.matchMedia ? window.matchMedia('(orientation: portrait)').matches : innerHeight >= innerWidth);
export function constraints(portrait, face, swap = false) {
  // sensor-native numbers differ between browsers: some already rotate to the screen orientation, some do not.
  // `swap` flips the request so start() can retry when the first stream came back in the wrong orientation.
  const long = { ideal: 1920 }, short = { ideal: 1080 }, tall = portrait !== swap;
  return { audio: false, video: { facingMode: { ideal: face }, width: tall ? short : long, height: tall ? long : short } };
}
export let rotation = 0; // 0 | 90 | -90: extra rotation needed when the browser delivers a landscape stream on a portrait screen
const open = async (c) => { try { return await navigator.mediaDevices.getUserMedia(c); } catch (e) { if (e && e.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: c.video.facingMode } }); throw e; } };
async function attach(video, st) { stream = st; video.srcObject = st; video.setAttribute('playsinline', ''); video.muted = true; await video.play(); if (!video.videoWidth) await new Promise((r) => { video.onloadedmetadata = r; setTimeout(r, 1500); }); }
export async function start(video, flip = false) {
  stop(); if (flip) facing = facing === 'environment' ? 'user' : 'environment';
  const portrait = isPortrait(); rotation = 0;
  await attach(video, await open(constraints(portrait, facing)));
  const wrong = () => video.videoWidth > 0 && (video.videoHeight > video.videoWidth) !== portrait;
  if (wrong()) { // first stream has the wrong orientation (the "rotate the phone and back" symptom) -> retry with the swapped request
    stop(); await attach(video, await open(constraints(portrait, facing, true)));
    if (wrong()) { const ang = (screen.orientation && screen.orientation.angle) || 0; rotation = ang === 270 || ang === -90 ? -90 : 90; }
  }
  video.classList.toggle('rot', rotation !== 0); video.style.setProperty('--rot', rotation + 'deg');
  return facing;
}
export function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
export const facingMode = () => facing;
export function capture(video) {
  const vw = video.videoWidth, vh = video.videoHeight, cv = document.createElement('canvas'), turn = rotation !== 0;
  cv.width = turn ? vh : vw; cv.height = turn ? vw : vh; const c = cv.getContext('2d');
  if (turn) { c.translate(cv.width / 2, cv.height / 2); c.rotate((rotation * Math.PI) / 180); c.drawImage(video, -vw / 2, -vh / 2); } else c.drawImage(video, 0, 0);
  return cv;
}
/** Maps getUserMedia errors to i18n keys. */
export function errorKey(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'camera.denied';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'camera.notfound';
  if (n === 'NotReadableError') return 'camera.busy';
  return 'camera.error';
}
