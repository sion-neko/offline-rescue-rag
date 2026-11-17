// web 版（expo export の結果 dist/）と models/ を配信する、検証用の小さなサーバー。
// wllama のマルチスレッドに必要な COOP/COEP ヘッダーを付ける。
// 使い方: npm run web:build && npm run web:serve  →  http://localhost:8081
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// .pathname だと Windows で "/D:/..." になるので fileURLToPath で変換する
const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 8081);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".wasm": "application/wasm", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".css": "text/css" };

createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const base = url.startsWith("/models/") ? root : join(root, "dist");
  let file = normalize(join(base, url));
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "dist", "index.html");
  const size = statSync(file).size;
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes" });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": size, "Accept-Ranges": "bytes" });
    createReadStream(file).pipe(res);
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
