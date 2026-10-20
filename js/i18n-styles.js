// i18n-styles.js - texts for styles (built-in / my styles), random tendency and the new palettes.
export const STYLES_JA = {
  'preset.label': '配色', 'preset.etching': 'エッチング（墨）', 'preset.etchblue': 'エッチング（藍）', 'preset.sanguine': 'サンギーヌ（赤褐色）', 'preset.silver': '銀塩モノクロ', 'preset.sepia': 'セピア', 'preset.selenium': 'セレン調色',
  'tb.camera': '撮り直す', 'tb.color': '色', 'tb.shape': '形・質感', 'rnd.title': 'ランダム生成', 'rnd.lock.note': '色タブで固定した色（配色・ハーフトーン色・線の色）は、ランダム生成でも変わりません。', 'color.lock.title': '色の固定', 'color.lock.note': '固定した色は、スタイルの適用・ランダム生成で変わりません。気に入った色を残したまま画風だけ変えたいときに使います。', 'color.lock.palette': '配色を固定', 'color.lock.ht': 'ハーフトーンの色を固定', 'color.lock.line': '線の色を固定', 'color.ht.off': 'トーン（銀塩・2階調）かハーフトーンを使っているとき、またはハイブリッドで使えます（形・質感タブで設定）。',
  'p.htColor': 'インクの色（ハーフトーン・トーン）', 'preset.vec.note': 'ベクターでは、配色はトーン／ハーフトーンのインク色と紙色に使われます（面の色は写真のままです）。', 'ht.color.auto': '配色に合わせる', 'ht.color.autoon': '配色に連動中',
  'style.title': 'スタイル', 'style.note': 'スタイルは配色だけでなく、段数・質感・ハーフトーン・線など全設定をまとめて切り替えます（文字と端末設定は変わりません）。',
  'style.builtin': 'おすすめスタイル', 'style.mine': 'マイスタイル', 'style.none': 'まだ保存したスタイルはありません。',
  'style.etching': 'エッチング（銅版画）', 'style.silver': '銀塩写真', 'style.sepia': 'セピア写真', 'style.silkscreen': 'シルクスクリーン', 'style.popart': 'ポップアート', 'style.engraving': 'エングレービング', 'style.pen': 'ペン画', 'style.sleeve': 'レトロ・レコード', 'style.vector': 'ベクターイラスト', 'style.poster': 'ポスター', 'style.silhouette': 'シルエット',
  'st.save': '現在の設定を保存', 'st.overwrite': '上書き保存', 'st.rename': '名前を変更', 'st.delete': '削除', 'st.export': '書き出し（JSON）', 'st.exportall': 'すべて書き出し', 'st.import': '読み込み（JSON）',
  'st.cancel': 'キャンセル', 'st.ok': 'OK', 'st.name.save': 'マイスタイルとして保存', 'st.name.rename': 'スタイル名を変更', 'st.name.ph': 'スタイル名', 'st.del.title': 'スタイルを削除', 'st.del.msg': '「{name}」を削除します。よろしいですか？',
  'st.saved': '「{name}」を保存しました', 'st.over': '「{name}」を上書きしました', 'st.deleted': '「{name}」を削除しました', 'st.applied': 'スタイル「{name}」を適用しました', 'st.imported': '{n}件のスタイルを読み込みました', 'st.bad': 'スタイルのファイルとして読み込めませんでした', 'st.full': '保存できる数の上限です。不要なスタイルを削除してください', 'st.nostore': 'この端末では保存できませんでした',
  'st.selected': '選択中のマイスタイル', 'st.active': '適用中',
  'rnd.tend': '画風の傾向', 'rnd.tend.note': '傾向を選ぶと、その画風として成立しやすい配色・質感・背景・線を選びます（ハイブリッドで生成）。オフは完全ランダムです。',
  'rnd.tend.watercolor': '水彩画', 'rnd.tend.off': 'オフ（完全ランダム）', 'rnd.tend.etching': 'エッチング（銅版画）', 'rnd.tend.silver': '銀塩写真', 'rnd.tend.silkscreen': 'シルクスクリーン', 'rnd.tend.popart': 'ポップアート',
};
export const STYLES_EN = {
  'preset.label': 'Palette', 'preset.etching': 'Etching (ink)', 'preset.etchblue': 'Etching (indigo)', 'preset.sanguine': 'Sanguine (red-brown)', 'preset.silver': 'Silver-gelatin B&W', 'preset.sepia': 'Sepia', 'preset.selenium': 'Selenium toned',
  'tb.camera': 'Retake', 'tb.color': 'Colour', 'tb.shape': 'Shape & texture', 'rnd.title': 'Randomise', 'rnd.lock.note': 'Colours locked on the Colour tab (palette, halftone colour, line colours) stay as they are when you randomise.', 'color.lock.title': 'Colour locks', 'color.lock.note': 'Locked colours do not change when you apply a style or randomise. Use it to keep colours you like while changing the look.', 'color.lock.palette': 'Lock palette', 'color.lock.ht': 'Lock halftone colour', 'color.lock.line': 'Lock line colours', 'color.ht.off': 'Available with a tone (silver / two-tone), with halftone, or in Hybrid mode (set on the Shape & texture tab).',
  'p.htColor': 'Ink colour (halftone / tone)', 'preset.vec.note': 'In Vector mode the palette sets the ink and paper colour of the tone / halftone layers (the fills keep the photo colours).', 'ht.color.auto': 'Follow palette', 'ht.color.autoon': 'follows palette',
  'style.title': 'Styles', 'style.note': 'A style switches every setting at once - palette, levels, texture, halftone, lines (your texts and device settings are kept).',
  'style.builtin': 'Built-in styles', 'style.mine': 'My styles', 'style.none': 'No saved styles yet.',
  'style.etching': 'Etching (copperplate)', 'style.silver': 'Silver-gelatin photo', 'style.sepia': 'Sepia photo', 'style.silkscreen': 'Silkscreen', 'style.popart': 'Pop art', 'style.engraving': 'Engraving', 'style.pen': 'Pen drawing', 'style.sleeve': 'Retro record sleeve', 'style.vector': 'Vector illustration', 'style.poster': 'Poster', 'style.silhouette': 'Silhouette',
  'st.save': 'Save current settings', 'st.overwrite': 'Overwrite', 'st.rename': 'Rename', 'st.delete': 'Delete', 'st.export': 'Export (JSON)', 'st.exportall': 'Export all', 'st.import': 'Import (JSON)',
  'st.cancel': 'Cancel', 'st.ok': 'OK', 'st.name.save': 'Save as my style', 'st.name.rename': 'Rename style', 'st.name.ph': 'Style name', 'st.del.title': 'Delete style', 'st.del.msg': 'Delete "{name}"?',
  'st.saved': 'Saved "{name}"', 'st.over': 'Overwrote "{name}"', 'st.deleted': 'Deleted "{name}"', 'st.applied': 'Applied style "{name}"', 'st.imported': 'Imported {n} style(s)', 'st.bad': 'This file is not a valid style file', 'st.full': 'Style limit reached. Delete some styles first', 'st.nostore': 'Could not save on this device',
  'st.selected': 'Selected style', 'st.active': 'In use',
  'rnd.tend': 'Style tendency', 'rnd.tend.note': 'Pick a look and the random result stays inside it (palette, texture, background, lines; built in hybrid mode). Off = fully random.',
  'rnd.tend.watercolor': 'Watercolour', 'rnd.tend.off': 'Off (fully random)', 'rnd.tend.etching': 'Etching (copperplate)', 'rnd.tend.silver': 'Silver-gelatin photo', 'rnd.tend.silkscreen': 'Silkscreen', 'rnd.tend.popart': 'Pop art',
};
