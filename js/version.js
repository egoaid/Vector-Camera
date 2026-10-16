// version.js - single source of truth for app / module versions (shown in the About dialog).
export const APP_NAME = 'Vector Camera';
export const APP_VERSION = '0.9.0-beta.1';
export const BUILD_ID = '20261016.1';
export const BUILD_DATE = '2026-10-16';
export const SETTINGS_SCHEMA = 5;
export const PIPELINE_REV = '1.1.0';
export const COPYRIGHT = '© 2026 egoaid. All rights reserved.';
export const MODULE_VERSIONS = {
  'version.js': '1.0.0', 'config.js': '1.7.0', 'state.js': '1.2.0', 'app.js': '2.1.0',
  'i18n.js': '1.5.0', 'i18n-ja.js': '1.1.0', 'i18n-en.js': '1.1.0',
  'wake-lock.js': '1.0.0', 'camera.js': '1.2.0', 'image-input.js': '1.0.0', 'pwa.js': '1.1.0',
  'ui-views.js': '1.1.0', 'ui-controls.js': '1.7.0', 'ui-compare.js': '1.3.0', 'ui-export.js': '1.2.0', 'ui-about.js': '1.1.0', 'ui-toast.js': '1.1.0',
  'color-utils.js': '1.1.0', 'seg-slic.js': '1.0.0', 'seg-edges.js': '1.0.0', 'seg-merge.js': '1.0.0', 'seg-stats.js': '1.0.0', 'seg-semantic.js': '1.1.0', 'seg-saliency.js': '1.0.0', 
  'vec-chains.js': '1.0.0', 'vec-curves.js': '1.0.0', 'vec-geometry.js': '1.0.0',
  'style-palette.js': '1.2.0', 'style-scene.js': '1.6.0',
  'render-svg.js': '1.1.0', 'render-canvas.js': '1.1.0', 'render-ink.js': '1.6.0', 'render-pdf.js': '1.1.0', 'render-png.js': '1.0.0', 'util-deflate.js': '1.0.0', 'export-files.js': '1.1.0',
  'pipeline-core.js': '1.0.0', 'pipeline-worker.js': '1.2.0', 'pipeline-client.js': '1.1.0',
  'i18n-ja-v2.js': '1.2.0', 'i18n-en-v2.js': '1.2.0', 'font-ttf.js': '1.0.0', 'style-text.js': '1.3.0', 'style-collage.js': '1.1.0', 'style-random.js': '1.7.0', 'ui-extras.js': '1.6.0', 'vec-ink.js': '1.0.0', 'render-strips.js': '1.0.0', 'text-fx.js': '1.2.0', 'ui-camera.js': '1.0.0', 'ui-zoom.js': '1.1.0', 'ui-stage.js': '1.1.0', 'ui-sheet.js': '1.1.0', 'ui-layout.js': '1.0.0', 'etching.js': '1.3.0', 'i18n-manual-ja.js': '1.0.0', 'i18n-manual-en.js': '1.0.0', 'ui-textbox.js': '1.1.0', 'halftone-types.js': '1.3.0',
  'i18n-styles.js': '1.2.0', 'style-presets.js': '1.3.0', 'style-tendency.js': '1.1.0', 'ui-styles.js': '1.1.0',
  'face-landmarks.js': '2.0.0', 'scene-kinds.js': '1.1.0',
  'ui-hub.js': '1.0.0', 'tone-photo.js': '1.0.0', 'face-engines.js': '1.0.0', 'face-engine-legacy.js': '1.0.0', 'face-engine-modern.js': '1.0.0', 'face-profiles.js': '1.0.0', 'ui-faces.js': '1.0.0', 'ui-engine-ab.js': '1.0.0', 'ui-tone.js': '1.0.0', 'i18n-ja-v4.js': '1.0.0', 'i18n-en-v4.js': '1.0.0', 'i18n-ja-v3.js': '1.0.0', 'i18n-en-v3.js': '1.0.0',
};
export const versionString = () => `v${APP_VERSION} (build ${BUILD_ID})`;
