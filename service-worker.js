/* service-worker.js - app-shell cache (same-origin only). */
const VERSION = '0.12.0-beta.1';
const BUILD = '20261018.2';
const CACHE = `vector-camera-${VERSION}-${BUILD}`;
const SHELL = [
  './', 'index.html', 'manifest.json',
  'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/camera.css', 'css/result.css', 'css/compare.css', 'css/zoom.css', 'css/sheet.css', 'css/text-panel.css', 'css/style-lib.css', 'css/hub.css', 'css/phone.css',
  'icons/favicon-16.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/version.js', 'js/config.js', 'js/state.js', 'js/i18n.js', 'js/i18n-ja.js', 'js/i18n-en.js',
  'js/wake-lock.js', 'js/camera.js', 'js/image-input.js', 'js/pwa.js',
  'js/ui-views.js', 'js/ui-controls.js', 'js/ui-compare.js', 'js/ui-export.js', 'js/ui-about.js', 'js/ui-toast.js',
  'js/color-utils.js', 'js/seg-slic.js', 'js/seg-edges.js', 'js/seg-merge.js', 'js/seg-stats.js', 'js/seg-semantic.js', 'js/seg-saliency.js',
  'js/vec-chains.js', 'js/vec-smooth.js', 'js/vec-curves.js', 'js/vec-geometry.js', 'js/style-palette.js', 'js/style-scene.js',
  'js/render-svg.js', 'js/render-canvas.js', 'js/render-ink.js', 'js/render-pdf.js', 'js/render-png.js', 'js/util-deflate.js', 'js/export-files.js',
  'js/pipeline-core.js', 'js/pipeline-worker.js', 'js/pipeline-client.js',
  'js/i18n-ja-v2.js', 'js/i18n-en-v2.js', 'js/tone-photo.js', 'js/style-space.js', 'js/style-colors.js', 'js/face-engines.js', 'js/face-engine-modern.js', 'js/face-frame-modern.js', 'engine/modern-frame.html', 'js/ui-faces.js', 'css/faces.css', 'js/ui-tone.js', 'js/i18n-ja-v4.js', 'js/i18n-en-v4.js', 'js/font-ttf.js', 'js/style-text.js', 'js/style-collage.js', 'js/style-random.js', 'js/ui-extras.js', 'js/vec-ink.js', 'js/render-strips.js', 'js/text-fx.js', 'js/ui-camera.js', 'js/i18n-styles.js', 'js/style-presets.js', 'js/style-tendency.js', 'js/ui-styles.js', 'js/face-landmarks.js', 'js/scene-kinds.js', 'js/ui-zoom.js', 'js/ui-stage.js', 'js/ui-sheet.js', 'js/ui-layout.js', 'js/etching.js', 'js/i18n-manual-ja.js', 'js/i18n-manual-en.js', 'js/ui-textbox.js', 'js/halftone-types.js', 'js/ui-hub.js', 'js/i18n-ja-v3.js', 'js/i18n-en-v3.js', 'js/i18n-ja-v5.js', 'js/i18n-en-v5.js',
];  // fonts/*.ttf are fetched on demand and cached at runtime
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('vector-camera-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/vendor/')) { e.respondWith(caches.open('vc-vendor').then(async (c) => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; })); return; } // bundled face-analysis files: kept across app updates, so they download once
  if (req.mode === 'navigate') { e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', cp)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});
