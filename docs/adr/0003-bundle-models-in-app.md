# 0003 モデルはアプリに同梱する

- 状態：採用
- 日付：2026-11-16

## 背景
- 山に入る前にアプリを開くとは限らない。入れた瞬間から圏外で使えてほしい
- モデルは合計約 1.4GB（LFM3-1.7B 約 1.1GB、EmbeddingGemma 約 330MB）

## 決定
- モデルは git に入れず、`scripts/download-models.sh` でダウンロードする。EAS では `eas-build-post-install` で実行する
- config plugin（`plugins/with-bundled-models.js`）で、モデルとライセンス文を iOS アプリ本体に入れる。llama.rn からは `is_model_asset: true` で読む
- Metro のアセットにはしない（EAS Update で毎回 1GB 以上配信されてしまうため）
- メモリ上限を広げる許可（increased-memory-limit、extended-virtual-addressing）を入れる。llama.rn の plugin は EAS のプロファイル名で判断するので、`entitlementsProfile` に production・preview・development を指定する

## 検討した案
- 初回起動時にダウンロード：アプリは軽いが、山に入る前に開いておく必要があり、ダウンロード画面も要る

## 結果
- アプリが大きい（約 1.4GB）
- モデルを替えるたびに EAS Build が要る。JS の修正だけなら EAS Update で済む
