// i18n-en.js - English strings.
export const EN = {
  'app.tagline': 'Turn photos into vector, print, watercolour and etching style art. Everything stays on your device.',
  'start.camera': 'Take a photo', 'start.choose': 'Choose an image',
  'start.hint': 'Your images are never uploaded.',
 
 
 
  'start.quality': 'Analysis size', 'quality.low': 'Light (512px)', 'quality.standard': 'Standard (768px)', 'quality.high': 'High (1024px, slower)',
  'start.wake': 'Keep the screen awake while in use', 'wake.on': 'Screen wake lock: on', 'wake.off': 'Screen wake lock: off', 'wake.unsupported': 'Screen wake lock is not supported on this device/browser', 'wake.denied': 'Could not acquire the wake lock (e.g. battery saver)',
  'camera.timer': 'Self-timer', 'camera.timer.off': 'Timer off', 'camera.title': 'Camera', 'camera.shutter': 'Capture', 'camera.switch': 'Switch camera', 'camera.close': 'Close',
  'camera.denied': 'Camera access was denied. Allow it in your browser settings, or use "Choose an image".',
  'camera.notfound': 'No camera found. Please use "Choose an image".', 'camera.busy': 'The camera is in use by another app.', 'camera.error': 'Could not start the camera.', 'camera.unsupported': 'This browser cannot capture from the camera. Please use "Choose an image".',
  'proc.title': 'Converting…', 'proc.cancel': 'Cancel', 'proc.prepare': 'Preparing image','proc.segment': 'Segmenting regions', 'proc.merge': 'Merging regions', 'proc.regions': 'Cleaning up regions', 'proc.vectorize': 'Vectorising', 'proc.done': 'Finishing',
 'proc.cancelled': 'Cancelled.',
  'err.generic': 'Processing failed. Try a smaller image and retry.', 'err.load': 'Could not load the image.','err.memory': 'Possibly out of memory. Set analysis size to "Light".',
 
 
  'result.original': 'Original', 'result.result': 'Result', 'result.compare': 'Compare', 'result.edit': 'Fix subject / background', 'result.edit.hint': 'Tap a region to cycle it: background → middle → subject.', 'result.edit.reset': 'Reset manual fixes',
  'result.new': 'Choose another image', 'result.retake': '📷 Retake with camera', 'result.rerun': 'Re-analyse', 'badge.vector': 'Vector preview', 'badge.hybrid': 'Hybrid (includes raster)', 'badge.classic': 'Standard analysis', 'badge.ai': 'Subject detection', 'badge.regions': '{n} regions',
  'mode.vector': 'Vector', 'mode.silhouette': 'Silhouette', 'mode.regions': 'Color regions', 'mode.hybrid': 'Silkscreen',
  'mode.vector.desc': 'Editable vector illustration that keeps photo colours', 'mode.silhouette.desc': 'Bold flat shapes emphasising the subject outline', 'mode.regions.desc': 'Poster-like large colour areas', 'mode.hybrid.desc': 'Processed photo layered inside vector shapes, print style',
  'preset.label': 'Style', 'preset.natural': 'Natural', 'preset.pop': 'Pop', 'preset.sleeve': 'Retro sleeve', 'preset.riso': 'Riso', 'preset.duo': 'Duotone', 'preset.mono': 'Mono', 'preset.custom': 'Custom',
  'p.detail': 'Detail', 'p.simplify': 'Shape simplification', 'p.angularity': 'Smooth ↔ Sharp', 'p.paletteK': 'Colours', 'p.subjectSize': 'Subject size', 'p.separation': 'Colour separation (levels)', 'p.retention': 'Photo retention', 'p.grain': 'Grain', 'p.misreg': 'Misregistration', 'p.halftone': 'Halftone', 'p.halftoneSize': 'Dot size', 'p.halftoneAngle': 'Dot angle', 'p.roughness': 'Ink roughness', 'p.paper': 'Paper texture', 'p.boundary': 'Boundary sensitivity', 'p.minRegion': 'Small-region cleanup', 'p.outline': 'Outline', 'p.semStrength': 'Detected-edge priority',
  'p.bg': 'Background', 'bg.flat': 'Flat colour', 'bg.photo': 'Add photo ink', 'bg.paper': 'Bare paper', 'p.map': 'Colour mapping', 'map.luma': 'By brightness', 'map.nearest': 'Nearest colour',
  'p.off': 'Off', 'p.on': 'On', 'sil.bg': 'Background', 'sil.mid': 'Middle', 'sil.fg': 'Subject', 'sil.sample': 'Sample colours from photo', 'p.seal': 'Seam sealing', 'adv': 'Advanced',
  'exp.title': 'Export', 'exp.size': 'Output size (long edge)', 'exp.svg': 'SVG', 'exp.pdf': 'Vector PDF', 'exp.png': 'PNG', 'exp.jpeg': 'JPEG', 'exp.share': 'Share', 'exp.working': 'Exporting…', 'exp.done': 'Saved: {name}',
  'exp.note.vector': 'SVG and PDF are pure vector (paths and fills).', 'exp.note.hybrid': 'SVG and PDF contain vector shapes plus embedded raster images (the photo parts are raster). PNG / JPEG are flattened images.',
  'about.title': 'About', 'about.close': 'Close', 'about.version': 'Version', 'about.clear': 'Clear cache and reload', 'about.clear.done': 'Cache cleared.', 'about.thirdparty': 'Optional subject-detection model (image segmentation only; loaded at runtime, not bundled): Transformers.js (Apache-2.0), ONNX Runtime Web (MIT), SegFormer-B0 ADE20K weights (NVIDIA licence: research / evaluation use). Bundled fonts follow their own licences (fonts/LICENSES.txt).', 'about.licenses': 'Licences', 'about.privacy': 'Images are processed on your device and never sent to a server.',
  'toast.update': 'A new version is available. Reload to update.', 'toast.offline': 'Already-loaded features keep working offline.', 'lang.toggle': '日本語',
  'sw.reload': 'Reload',
};
