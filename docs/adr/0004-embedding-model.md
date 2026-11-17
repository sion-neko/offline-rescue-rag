# 0004 検索用の embedding は EmbeddingGemma-300m

- 状態：採用
- 日付：2026-11-16

## 背景
- 質問の意味で資料を探すための embedding モデルが要る。日本語で、端末に載る大きさのもの

## 決定
- EmbeddingGemma-300m（QAT Q8_0、約 330MB）を使う
- 接頭辞は、検索が `task: search result | query: `、資料が `title: {title} | text: `、文どうしの比較が `task: sentence similarity | query: `

## 検討した案
4 つの文（道・寒さ・救助・関係ないカレー）と 3 つの質問で比べた。

| モデル | サイズ | 正解と 2 位の差 | 関係ない文 |
|---|---|---|---|
| multilingual-e5-small | 130MB | 0.01〜0.03 | 正解と同点になる問いがあった |
| ruri-v3-70m | 77MB | 0.003〜0.035 | 2 位に入る |
| ruri-v3-130m | 143MB | 0.03〜0.04 | 3 位前後 |
| EmbeddingGemma-300m | 330MB | 0.1〜0.26 | 3 問とも最下位 |

## 結果
- 点数の差がはっきりしているので、「資料にない」と判定する閾値を引きやすい（0006）
- 配布するときは Gemma 利用規約の同梱が要る（未対応）
