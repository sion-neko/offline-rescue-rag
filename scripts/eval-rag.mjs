// アプリと同じ設定（src/rag/config.json）で「質問 → 検索 → 要約」を通しで試す。
// 使い方: node scripts/eval-rag.mjs ["質問" ...]
import { readFileSync } from "node:fs";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const questions = process.argv.slice(2).length ? process.argv.slice(2) : [
  "道がわからなくなった",
  "寒くて震えが止まらない",
  "電波がない時に助けを呼ぶには",
  "もうすぐ暗くなる",
  "富士山の標高は？",
  "カレーの作り方を教えて",
];

const llama = await getLlama({ gpu: false });
const em = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ec = await em.createEmbeddingContext();
const lm = await llama.loadModel({ modelPath: root + "models/llm.gguf" });
const lc = await lm.createContext({ contextSize: 4096 });

for (const q of questions) {
  const { vector } = await ec.getEmbeddingFor(config.queryPrefix + q);
  const n = Math.hypot(...vector);
  const hits = index.chunks
    .map((c) => ({ c, score: c.vector.reduce((s, v, i) => s + v * (vector[i] / n), 0) }))
    .sort((a, b) => b.score - a.score);
  console.log(`\n### ${q}`);
  console.log(hits.slice(0, 4).map((h) => `${h.score.toFixed(3)} ${h.c.title}`).join(" / "));
  const used = hits.slice(0, config.topK).filter((h) => h.score >= config.minScore);
  if (!used.length) { console.log("→ " + config.noHitAnswer); continue; }
  const context = used.map((h) => config.contextTemplate.replace("{title}", h.c.title).replace("{text}", h.c.text)).join("\n\n");
  const seq = lc.getSequence();
  const s = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.systemPrompt });
  const t = Date.now();
  const a = await s.prompt(config.userTemplate.replace("{context}", context).replace("{question}", q), config.generation);
  console.log(a, `\n(${Date.now() - t}ms)`);
  seq.dispose();
}
