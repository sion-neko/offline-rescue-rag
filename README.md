# offline-rescue-rag

圏外でも使える、山の遭難時の手引きアプリ（検証版）。
スマホの中だけで「質問 → マニュアル検索 → 要約」をする（オンデバイス RAG）。

## 構成

| 部品 | iPhone | web（動作確認用） |
|---|---|---|
| 要約 LLM | llama.rn + LFM2.5-1.2B-JP-202606（Q4_K_M） | wllama（同じ GGUF） |
| embedding | llama.rn + EmbeddingGemma-300m（QAT Q8_0） | wllama（同じ GGUF） |
| ベクトル検索 | op-sqlite + sqlite-vec | JS で全件のコサイン類似度 |

- マニュアル：`data/manual/*.md`（いまは**仮データ・未監修**）。`## ` 見出しごとに 1 チャンク
- ベクトル化済みの索引：`assets/rag/index.json`（`npm run index` で作り直す）
- プロンプト・閾値：`src/rag/config.json`（アプリと `scripts/eval-rag.mjs` で共通）
- モデルは git に入れず、`npm run models` でダウンロードする。iOS では config plugin（`plugins/with-bundled-models.js`）がアプリ本体に同梱する

## よく使うコマンド

```sh
npm install
npm run models          # モデルを models/ にダウンロード（約1.06GB）
npm run index           # マニュアルを書き換えたら索引を作り直す
npm run eval            # Linux/Mac で「質問→検索→要約」を通しで試す
npm run web:build && npm run web:serve   # web 版を http://localhost:8081 で動かす
npm run typecheck
```

## iPhone で試す

EAS Build でクラウドビルドし、TestFlight で入れる。EAS では `eas-build-post-install` でモデルをダウンロードしてから prebuild する。

## ライセンス

- LFM2.5-1.2B-JP-202606：LFM Open License v1.0（ライセンス文をアプリに同梱する）
- EmbeddingGemma：Gemma 利用規約
