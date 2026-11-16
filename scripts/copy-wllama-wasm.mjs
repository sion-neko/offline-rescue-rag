// web 版で使う wllama の wasm を public/ にコピーする（npm install のたびに実行）。
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const src = root + "node_modules/@wllama/wllama/esm/wasm/wllama.wasm";
if (existsSync(src)) {
  mkdirSync(root + "public/wllama", { recursive: true });
  copyFileSync(src, root + "public/wllama/wllama.wasm");
}
