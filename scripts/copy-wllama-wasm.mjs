// web 版で使う wllama の wasm を public/ にコピーする（npm install のたびに実行）。
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// .pathname だと Windows で "/D:/..." になるので fileURLToPath で変換する
const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "node_modules/@wllama/wllama/esm/wasm/wllama.wasm");
if (existsSync(src)) {
  mkdirSync(join(root, "public/wllama"), { recursive: true });
  copyFileSync(src, join(root, "public/wllama/wllama.wasm"));
} else {
  console.warn(`wllama の wasm が見つかりません: ${src}`);
}
