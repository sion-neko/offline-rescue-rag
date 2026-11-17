# offline-rescue-rag

圏外でも使える、山の遭難時の手引きアプリ（検証版）。
スマホの中だけで、マニュアルの検索と、AI による要点の選び出しをする（オンデバイス RAG）。

## 画面

| 画面 | ファイル | 内容 |
|---|---|---|
| ホーム | `src/app/index.tsx` | 検索欄、「いまの状況」ボタン、最近の検索、目次・救助を呼ぶ |
| 検索結果 | `src/app/result.tsx` | AIが選んだ要点 → いちばん近い資料の原文 → あわせて確認 → 関連する資料 |
| 資料のページ | `src/app/section/[id].tsx` | マニュアルの原文。AIのまとめの出典から来たときは該当行にマーカー |
| 目次 | `src/app/contents.tsx` | AI を通さずにマニュアルを読む |
| 救助を呼ぶ | `src/app/emergency.tsx` | 110/119、GPS の緯度経度（度分秒も）、わたしの情報、伝えることのチェックリスト、圏外のとき |
| わたしの情報 | `src/app/profile.tsx` | 名前・持病・緊急連絡先・ルートなどを登山前に入れておく（端末の中だけに保存） |
| このアプリについて | `src/app/about.tsx` | しくみ、注意、使っている AI、開発者向けのログ |

- 右上の赤い電話ボタンから、どの画面でも救助を呼ぶ画面に行ける
- 文中の用語（沢・尾根・ビバークなど）はタップで説明が出る（`data/glossary.md`、AI は使わない）
- ホーム右上で黒い「夜・節電」表示に切り替えられる

## 答えの作り方

1. 言い換えの辞書（`data/synonyms.json`）で質問を補い、マニュアルの項目を検索する（EmbeddingGemma-300m）
2. LLM（LFM3-1.7B）に、見つかった資料から質問に合う文を**そのまま書き写して**選ばせる（考える過程は切る）
3. 書いた行のうち、原文の行とほぼ一致するもの（近さ 0.9 以上）だけを残し、**原文の行そのもの**を画面の先頭に出す。一致しない行（作り話・余計な行）は捨てる
4. その下に、いちばん近い項目の要点を原文のまま全部出す（AI の選び漏れがあっても見えるように。AI の準備中も先に読める）
5. 関連と指定した項目から、質問に近い行を「あわせて確認」として出す

LLM に自由に要約させると、意味を変えたり資料にないことを書いたりしたため、この形にした。モデルとプロンプトの比較は `docs/llm-comparison.md`。

## 構成

| 部品 | iPhone | web（動作確認用） |
|---|---|---|
| 要点を選ぶ LLM | llama.rn + LFM3-1.7B（Q4_K_M） | wllama（同じ GGUF） |
| embedding | llama.rn + EmbeddingGemma-300m（QAT Q8_0） | wllama（同じ GGUF） |
| ベクトル検索 | op-sqlite + sqlite-vec | JS で全件のコサイン類似度 |

- マニュアル：`data/manual/*.md`（いまは**仮データ・未監修**）。`## 見出し` の次に `分類:` と `関連:` の行を書く
- 用語集：`data/glossary.md`（仮データ・未監修）
- 索引：`assets/rag/index.json`（`npm run index` で作り直す。項目・要点ごとのベクトル、関連する資料、用語集）
- プロンプト・閾値：`src/rag/config.json`
- モデルは git に入れず、`npm run models` でダウンロードする。iOS では config plugin（`plugins/with-bundled-models.js`）がアプリ本体に同梱する

## よく使うコマンド

```sh
npm install
npm run models          # モデルを models/ にダウンロード（約1.4GB）
npm run index           # マニュアル・用語集を書き換えたら索引を作り直す
npm run typecheck && npx expo lint
npm run web:build && npm run web:serve   # web 版を http://localhost:8081 で動かす

# Linux/Mac で同じモデル・設定を試す
node scripts/eval-hybrid.mjs     # 原文の要点＋あわせて確認
node scripts/eval-models.mjs <model.gguf> <出力.json> [プロンプト.json]   # LLM・プロンプトの比較
node scripts/eval-cite.mjs       # 作り話の行を出典の点数で見分けられるか
```

## iPhone で試す

EAS Build でクラウドビルドし、TestFlight で入れる。EAS では `eas-build-post-install` でモデルをダウンロードしてから prebuild する。

## ライセンス

- LFM3-1.7B：LFM Open License v1.0（ライセンス文をアプリに同梱する）
- EmbeddingGemma：Gemma 利用規約
