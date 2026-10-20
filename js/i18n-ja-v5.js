// i18n-ja-v5.js - v0.12.0 and later: Japanese text, paper margin / print edge. Loaded last, so these override older keys.
export const JA5 = {
  'tx.lang': '文字の言語', 'tx.lang.en': '英語（English）', 'tx.lang.ja': '日本語',
  'tx.cat.mincho': '明朝体', 'tx.cat.gothic': 'ゴシック体', 'tx.cat.round': '丸ゴシック体', 'tx.cat.jhand': '手書き・筆記体', 'tx.cat.pop': 'ポップ・デザイン系',
  'tx.latin': '英語用のフォントは英数字・記号のみ対応です。日本語を使うときは「文字の言語」を「日本語」にしてください。',
  'rnd.o.frame': '余白・縁（余白の幅・版ズレ・かすれ）',
  // v0.13.0: paper margin and print edge
  'grp.frame': '余白・縁', 'fr.note': '写真のまわりに紙の余白を付けます。版画のように、色の版がずれて、絵の縁から色がはみ出します。縁のかすれは白く塗らず、下の版の色が透けて見えます。インクのはね・滲みも付けられます（書き出しにも反映）。', 'p.frame': '余白の幅（0=なし）', 'p.framePlate': '縁の版ズレ（色のはみ出し）', 'p.frameSplat': 'インクのはね', 'p.frameStain': 'インクの滲み・汚れ', 'p.framePlateN': '版の数', 'p.frameRub': '縁のかすれ', 'p.frameShift': '絵のずれ・傾き', 'p.frameColor': '余白の紙の色',
  'fr.auto': '配色の紙色に戻す', 'fr.auto.on': '配色に合わせる', 'fr.reseed': '縁のパターンを変える',
  'p.lightDir': '光の向き（影・ズレの方向）', 'p.hueShift': '色相ずらし',
  'grp.inkfx': 'インク効果', 'ix.note': '画像全体に、色の境目からにじむインクの染みと、飛び散るインクのはねを加えます（どのモードでも使えます）。', 'p.inkStain': 'インクの滲み・汚れ', 'p.inkSplat': 'インクのはね', 'ix.reseed': 'パターンを変える',
  'mode.watercolor': '水彩画', 'mode.watercolor.desc': '写真を、筆で水彩絵の具を重ね塗りしたように。筆の跡・塗り残しの白・にじみ・紙の粒状感を再現', 'grp.wc': '水彩のようす',
  'p.wcPaper': '用紙', 'wc.paper.hot': '平滑（ホットプレス）', 'wc.paper.cold': '中目（コールドプレス）', 'wc.paper.tinted': 'ベージュの紙',
  'p.wcBleed': '色のにじみ（濡れた紙）', 'p.wcEdge': '縁の絵の具だまり', 'p.wcGran': '絵の具の粒状感', 'p.wcLight': '淡さ（透明感）', 'p.wcHl': '白抜き（ハイライト）', 'p.wcBloom': 'ムラ・にじみ花', 'p.wcBrush': '筆の大きさ', 'p.wcLayer': '重ね塗り',
};
