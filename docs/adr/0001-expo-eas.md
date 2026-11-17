# 0001 Expo と EAS Build で作る

- 状態：採用
- 日付：2026-11-16

## 背景
- 実機は iPhone 14。手元の PC は Windows で、Mac はない
- 外出先からでも作業を進めたい。個人開発のほかのアプリ（あいろく など）も Expo で、TestFlight に入れる流れに慣れている

## 決定
- Expo（React Native）で作り、画面の切り替えは Expo Router を使う
- iOS のビルドは EAS Build（クラウド）で行い、実機へは TestFlight で入れる
- ネイティブの設定は app.json と config plugin で行い、`ios/` は手で編集しない（CNG）

## 検討した案
- Swift で書く：Apple Foundation Models が使えるが、iOS 26 と Apple Intelligence 対応機（iPhone 15 Pro 以降）が必要で、iPhone 14 では動かない。Mac も要る
- Expo Go：llama.rn・op-sqlite などネイティブのライブラリが入らないので使えない

## 結果
- Mac なしで iOS アプリをビルドできる。ただし初回は Apple の署名（証明書・App Store Connect の登録）に本人の操作が要る
- 実機でしか確かめられないこと（速さ・メモリ）は、本人が TestFlight で確かめる
