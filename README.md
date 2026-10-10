# Vector Camera

写真を **ベクターイラスト** や **シルクスクリーン（版画）風アート** に変換する、無料のブラウザアプリです。
画像は端末の中だけで処理され、サーバーには送信されません。インストール・会員登録は不要です。

**アプリを開く:** https://egoaid.github.io/vector-camera/

![Vector Camera](icons/og-image.png)

## できること

| モード | 内容 | SVG / PDF |
|---|---|---|
| **ベクター** | 写真の色を保ったまま、輪郭に沿った領域に分割したイラスト | 純粋なベクター（パスと塗りのみ） |
| **シルエット** | 被写体・中景・背景を単色の形にした、構図重視のグラフィック | 純粋なベクター |
| **カラー領域** | 色数を絞り、大きな色面にまとめたポスター風 | 純粋なベクター |
| **シルクスクリーン** | フラットな色面（ベクター）の上に、ハーフトーンやグレインで加工した写真を重ねる、ポップアート／レトロな版画風 | ベクター形状＋埋め込みラスター画像（写真部分はラスター） |

- 隣り合う領域は **同じ境界線を共有** するため、隙間や重なりのないきれいなベクターになります。
- 書き出し形式: **SVG**（Illustrator / Inkscape / Figma などで編集可）、**ベクターPDF**、**PNG**、**JPEG**。
- 詳細度・簡略化・滑らか↔シャープ・色数・版ズレ・グレイン・ハーフトーンなどをスライダーで調整できます。重い解析をやり直さず、必要な部分だけ再計算します。
- 被写体の判定が合わないときは「前景/背景を直す」で、領域をタップして切り替えられます。
- 使用中は画面が自動的にスリープしないよう、Screen Wake Lock API で抑制します（対応ブラウザのみ。設定でオフにできます）。
- 日本語／English。

## 使い方

1. 「カメラで撮る」または「画像を選ぶ」をタップします（カメラの許可は、ボタンを押したときだけ求めます）。
2. 自動で領域が分割され、結果が表示されます。モードとスタイルを選び、スライダーで調整します。
3. 「書き出し」から SVG / ベクターPDF / PNG / JPEG を保存します。

ヒント: 動作が重いときは、スタート画面の「解析サイズ」を「軽量」にしてください。ホーム画面に追加すると、アプリのように起動できます。

## プライバシー

- 撮影・選択した画像は、お使いのブラウザの中でのみ処理されます。アップロード、アカウント、広告、解析用の通信はありません。
- 任意の **「AI強化」** を選んだ場合に限り、初回に AI モデル（SegFormer-B0、約4.4MB）と実行ランタイムを公開CDNからダウンロードします（以降はブラウザにキャッシュ）。このときも **画像は送信されません**。AI強化は初期設定ではオフです。
- 一度読み込んだ後は、標準エンジンはオフラインでも動作します（AI強化は初回ダウンロードが必要です）。

## 動作環境

- iPhone（Safari）、Android（Chrome）、デスクトップの最近のブラウザ。
- カメラ撮影にはブラウザのカメラ許可が必要です（許可できない場合は「画像を選ぶ」を使えます）。
- 画面スリープ抑制は、Screen Wake Lock API に対応したブラウザ（iOS 16.4 以降の Safari、Chrome など）で働きます。

## 制限事項（正直な説明）

- 自動の領域分割は完璧ではありません。写真によっては境界が合わないことがあり、その場合は「詳細度」「輪郭の感度」や、手動の「前景/背景を直す」で調整してください。
- 「標準エンジン」は色と輪郭を手がかりにした分割で、物体を意味的に理解するものではありません。被写体判定は位置・コントラスト等に基づく推定です。AI強化を使うと、AIが推定した領域の境界を優先します。
- シルクスクリーンモードの SVG / PDF では、写真由来のインク層はラスター画像です（ベクター形状でクリップされています）。完成した見た目をそのまま保存したいときは PNG / JPEG を使ってください。
- 高解像度や「高精細」設定は、古い端末ではメモリ不足になることがあります。
- 紙の質感（ノイズ）は PNG / JPEG と画面表示にのみ反映され、SVG / PDF には含まれません。

## 書き出したファイルの確認方法

- **SVG**: ブラウザや Inkscape / Illustrator で開き、拡大してもエッジがシャープなこと、パスを選択できることを確認します（ベクター／シルエット／カラー領域モードでは、画像オブジェクトは含まれません）。
- **PDF**: PDFビューアで最大まで拡大して、輪郭がぼやけないことを確認します（シルクスクリーンモードでは写真インク部分のみラスターです）。

## クレジットとライセンス

© 2026 egoaid. All rights reserved.

任意の「AI強化」は、実行時に以下を読み込みます（本リポジトリには含まれません）。

- [Transformers.js](https://github.com/huggingface/transformers.js)（Apache-2.0）
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime)（MIT）
- SegFormer-B0 ADE20K（[NVIDIA](https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512)、研究・評価目的を前提としたNVIDIAのライセンス）

プリセットの配色はこのプロジェクトのオリジナルです。特定のアーティストやレーベルとは関係ありません。

---

## English

Vector Camera is a free, privacy-first web app that turns photos into editable vector art (native SVG and true vector PDF) and screen-print style hybrid artwork. Everything runs in your browser — images are never uploaded. Modes: Vector, Silhouette, Color regions, Silkscreen (flat vector colour blocks + processed photo "ink" layers). Pure-vector modes export genuine paths and fills; the Silkscreen mode embeds raster ink layers clipped by vector paths (PNG / JPEG export the flattened result). The optional AI boost downloads a ~4.4 MB model plus runtime on first use only. The screen is kept awake while you use the app (Screen Wake Lock API, where supported).

© 2026 egoaid. All rights reserved.
