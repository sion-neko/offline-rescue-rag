// 型チェック用の入口。実行時は Metro が store.native.ts / store.web.ts を選ぶ。
export { createStore } from './store.native';
