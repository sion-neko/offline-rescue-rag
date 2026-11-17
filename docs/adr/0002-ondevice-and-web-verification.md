# 0002 端末の中だけで動かし、動作確認は web 版で行う

- 状態：採用
- 日付：2026-11-16

## 背景
- 圏外で使うアプリなので、検索も AI もすべて端末の中で動かす必要がある
- 開発はクラウドの Linux コンテナで行うことが多く、iOS のシミュレーターも実機も使えない。それでも「ちゃんと動くか」を確かめながら作りたい

## 決定
- LLM と embedding、ベクトル検索を、差し替えられる部品（`src/ai/engine.*.ts`、`src/rag/store.*.ts`）にする
  - iPhone：llama.rn ＋ op-sqlite（sqlite-vec）
  - web：wllama（同じ GGUF を WebAssembly で動かす）＋ JS で全件のコサイン類似度
- Claude が web 版を Playwright で操作して動作を確かめる。速さとメモリは本人が実機で確かめる
- 同じモデル・設定を Linux の node-llama-cpp でも動かし、質の比較はそこで行う（`scripts/eval-*.mjs`）

## 結果
- 画面・検索・AI の流れは、実機なしで確かめられる
- web 版は CPU だけで動くので遅い（AI の要点は 1 分前後）。速さの参考にはならない
- ネイティブ側の検索は、同じ版の sqlite-vec（v0.1.7-alpha.2）で同じ SQL を流し、web 版と点数が一致することを確かめた
