// i18n-en-v5.js - v0.12.0 and later: Japanese text, paper margin / print edge. Loaded last, so these override older keys.
export const EN5 = {
  'tx.lang': 'Text language', 'tx.lang.en': 'English', 'tx.lang.ja': 'Japanese (日本語)',
  'tx.cat.mincho': 'Mincho (serif)', 'tx.cat.gothic': 'Gothic (sans-serif)', 'tx.cat.round': 'Rounded gothic', 'tx.cat.jhand': 'Handwriting / brush', 'tx.cat.pop': 'Pop / display',
  'tx.latin': 'The English fonts cover Latin letters, digits and punctuation only. For Japanese, set "Text language" to Japanese.',
  'rnd.o.link': 'Linked mode (modulation matrix)', 'rnd.o.frame': 'Margin / print edge (width, plate shift, wear)',
  // v0.13.0: paper margin and print edge
  'grp.frame': 'Margin / print edge', 'fr.note': 'Adds a paper margin around the picture. Like a screen print, the colour plates sit slightly off, so colour peeks out past the picture edge (included in exports).', 'p.frame': 'Margin width (0 = none)', 'p.framePlate': 'Plate misregistration at the edge', 'p.framePlateN': 'Number of plates', 'p.frameRub': 'Edge wear', 'p.frameShift': 'Picture offset / tilt', 'p.frameColor': 'Margin paper colour',
  'fr.auto': 'Use the palette paper colour', 'fr.auto.on': 'follows the palette', 'fr.reseed': 'New edge pattern',
  'p.lightDir': 'Light direction (shadows / offsets)', 'p.hueShift': 'Hue shift',
  'lk.note': 'Six sources (M1-M6) move parameters by the amounts patched for each destination. Parameters also modulate each other, so every press gives an unexpected combination.',
  'p.linkDepth': 'Link depth', 'p.linkCross': 'Cross-modulation', 'lk.random': 'Patch: random (changes every press)', 'lk.fixed': 'Patch: fixed (uses the grid)', 'lk.fix': 'Fix this patch', 'lk.free': 'Back to random',
  'lk.g.shape': 'Shape', 'lk.g.tone': 'Tone', 'lk.g.texture': 'Texture', 'lk.g.plate': 'Plate', 'lk.g.dots': 'Dots', 'lk.g.line': 'Line', 'lk.g.light': 'Light/Hue',
};
