/* service-worker.js - app-shell cache (same-origin only). Models fetched from CDNs are cached by Transformers.js itself. */
const VERSION = '0.2.1-beta.1';
const BUILD = '20261012.1';
const CACHE = `vector-camera-${VERSION}-${BUILD}`;
const SHELL = [
  './', 'index.html', 'manifest.json',
  'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/camera.css', 'css/result.css', 'css/compare.css',
  'icons/favicon-16.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/version.js', 'js/config.js', 'js/state.js', 'js/i18n.js', 'js/i18n-ja.js', 'js/i18n-en.js',
  'js/wake-lock.js', 'js/camera.js', 'js/image-input.js', 'js/pwa.js',
  'js/ui-views.js', 'js/ui-controls.js', 'js/ui-compare.js', 'js/ui-export.js', 'js/ui-about.js', 'js/ui-toast.js',
  'js/color-utils.js', 'js/seg-slic.js', 'js/seg-edges.js', 'js/seg-merge.js', 'js/seg-stats.js', 'js/seg-semantic.js', 'js/seg-saliency.js', 'js/seg-segformer.js', 'js/ai-worker.js',
  'js/vec-chains.js', 'js/vec-curves.js', 'js/vec-geometry.js', 'js/style-palette.js', 'js/style-scene.js',
  'js/render-svg.js', 'js/render-canvas.js', 'js/render-ink.js', 'js/render-pdf.js', 'js/render-png.js', 'js/util-deflate.js', 'js/export-files.js',
  'js/pipeline-core.js', 'js/pipeline-worker.js', 'js/pipeline-client.js',
  'js/i18n-ja-v2.js', 'js/i18n-en-v2.js', 'js/font-ttf.js', 'js/style-text.js', 'js/style-collage.js', 'js/style-random.js', 'js/ui-extras.js', 'js/vec-ink.js', 'js/render-strips.js',
];  // fonts/*.ttf are fetched on demand and cached at runtime
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('vector-camera-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return; // never touch CDN / model traffic
  if (req.mode === 'navigate') { e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', cp)); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});
