// i18n-ja-v5.js - v0.12.0 and later: Japanese text, paper margin / print edge. Loaded last, so these override older keys.
export const JA5 = {
  'tx.lang': '文字の言語', 'tx.lang.en': '英語（English）', 'tx.lang.ja': '日本語',
  'tx.cat.mincho': '明朝体', 'tx.cat.gothic': 'ゴシック体', 'tx.cat.round': '丸ゴシック体', 'tx.cat.jhand': '手書き・筆記体', 'tx.cat.pop': 'ポップ・デザイン系',
  'tx.latin': '英語用のフォントは英数字・記号のみ対応です。日本語を使うときは「文字の言語」を「日本語」にしてください。',
  'rnd.o.link': '連動モード（モジュレーションマトリクス）', 'rnd.o.frame': '余白・縁（余白の幅・版ズレ・かすれ）',
  // v0.13.0: paper margin and print edge
  'grp.frame': '余白・縁', 'fr.note': '写真のまわりに紙の余白を付けます。版画のように、色の版がずれて、絵の縁から色がはみ出します（書き出しにも反映）。', 'p.frame': '余白の幅（0=なし）', 'p.framePlate': '縁の版ズレ（色のはみ出し）', 'p.framePlateN': '版の数', 'p.frameRub': '縁のかすれ', 'p.frameShift': '絵のずれ・傾き', 'p.frameColor': '余白の紙の色',
  'fr.auto': '配色の紙色に戻す', 'fr.auto.on': '配色に合わせる', 'fr.reseed': '縁のパターンを変える',
  'p.lightDir': '光の向き（影・ズレの方向）', 'p.hueShift': '色相ずらし',
  'lk.note': '6つの発信源（M1〜M6）が、行き先ごとに決めた量で各パラメーターを動かします。パラメーター同士も互いに影響し合うので、毎回予想外の組み合わせになります。',
  'p.linkDepth': '連動の深さ', 'p.linkCross': 'パラメーター同士の影響', 'lk.random': '配線: ランダム（押すたびに変わります）', 'lk.fixed': '配線: 固定（表の値を使います）', 'lk.fix': 'この配線を固定', 'lk.free': '固定をやめる',
  'lk.g.shape': '形', 'lk.g.tone': '階調', 'lk.g.texture': '質感', 'lk.g.plate': '版ズレ', 'lk.g.dots': '網点', 'lk.g.line': '線', 'lk.g.light': '光・色',
};
