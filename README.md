# yomito — PDF OCR

PDFをドラッグ＆ドロップし、ブラウザ内で文字を抽出する静的Webアプリです。

- 日本語・英語・日本語縦書き
- 文字レイヤーの直接抽出、スキャンページのTesseract OCR
- 高精度モード（高解像度＋best言語モデル）
- 結果の編集、コピー、UTF-8テキスト保存、中止
- 50MB、100ページまで。PDFは外部に送信しません。

OCR精度は原稿に依存します。手書き、複雑な表、画像とテキストが混在するページの画像内文字は完全に読み取れません。文字レイヤーがあるページは直接抽出を優先します。検索可能PDFの出力には対応していません。

## ローカルで起動

`python3 -m http.server 4173 --directory dist`

http://localhost:4173 を開きます。ビルド不要です。

## GitHub Pages

`gh-pages` ブランチのルートをGitHub Pagesで公開します。変更をmainにコミットした後、`./deploy.sh` を実行するとコミット済みの `dist/` が公開されます。

## 外部リソース・ライセンス

PDF.js 4.10.38（Apache-2.0）、Tesseract.js 6.0.1（Apache-2.0）を同梱。OCRワーカー、WASM、言語モデル、PDFの補助フォント/CMapは必要時に公式配布元/CDNから取得します。初回利用にはインターネット接続が必要です。これらのリクエストにPDFの内容は含まれません。

- https://github.com/mozilla/pdf.js
- https://github.com/naptha/tesseract.js
- https://github.com/tesseract-ocr/tessdata_best
