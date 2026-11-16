// data/manual/*.md を見出し（## ）ごとに分けてベクトル化し、assets/rag/index.json に書き出す。
// アプリ側では、この JSON をそのまま検索に使う（端末でマニュアルをベクトル化しない）。
// 使い方: node scripts/build-index.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { getLlama } from "node-llama-cpp";

const root = new URL("..", import.meta.url).pathname;
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));

const chunks = [];
for (const file of readdirSync(root + "data/manual").filter((f) => f.endsWith(".md")).sort()) {
  const source = file.replace(/\.md$/, "");
  const body = readFileSync(root + "data/manual/" + file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  for (const part of body.split(/^## /m).slice(1)) {
    const [title, ...rest] = part.split("\n");
    const text = rest.join("\n").trim();
    if (text) chunks.push({ id: `${source}-${chunks.length}`, source, title: title.trim(), text });
  }
}

const llama = await getLlama({ gpu: false });
const model = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ctx = await model.createEmbeddingContext();
for (const c of chunks) {
  const prefix = config.passagePrefix.replace("{title}", c.title);
  const { vector } = await ctx.getEmbeddingFor(prefix + c.text);
  const norm = Math.hypot(...vector);
  c.vector = Array.from(vector, (v) => Math.round((v / norm) * 1e5) / 1e5);
}

const out = { embedModel: config.embedModel, dim: chunks[0].vector.length, chunks };
writeFileSync(root + "assets/rag/index.json", JSON.stringify(out));
console.log(`wrote ${chunks.length} chunks, dim=${out.dim}`);
