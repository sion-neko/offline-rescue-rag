# ADR（設計の決定の記録）

| 番号 | 題名 | 状態 |
|---|---|---|
| [0001](0001-expo-eas.md) | Expo と EAS Build で作る | 採用 |
| [0002](0002-ondevice-and-web-verification.md) | 端末の中だけで動かし、動作確認は web 版で行う | 採用 |
| [0003](0003-bundle-models-in-app.md) | モデルはアプリに同梱する | 採用 |
| [0004](0004-embedding-model.md) | 検索用の embedding は EmbeddingGemma-300m | 採用 |
| [0005](0005-llm-model.md) | 要点を選ぶ LLM は LFM3-1.7B | 採用 |
| [0006](0006-answer-shape.md) | 答えは「AI が選んだ原文の行」と「いちばん近い資料の原文」 | 採用（一部提案中） |
| [0007](0007-search-style-ui.md) | 画面はチャットではなく「検索型」にする | 採用 |
| [0008](0008-no-ai-for-related-and-glossary.md) | 関連する資料・あわせて確認・用語解説は AI を通さない | 採用 |
| [0009](0009-search-thresholds-and-synonyms.md) | 「資料にない」の判定と、言い換えの辞書 | 採用 |
| [0010](0010-emergency-screen-and-profile.md) | 救助を呼ぶ画面と、わたしの情報 | 採用 |
| [0011](0011-manual-format.md) | マニュアルの書き方 | 採用 |

書き方：状態・日付・背景・決定・検討した案・結果。決定を変えたときは、元の ADR の状態を書き換え、変えた理由を残す。
