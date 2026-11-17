// アプリの「AIで短くまとめる」と同じ手順（検索 → 要約 → 各行に近い原文の出典を付ける）を試す。
import { readFileSync } from "node:fs";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
const root = new URL("..", import.meta.url).pathname;
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const llama = await getLlama({ gpu: false });
const em = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ec = await em.createEmbeddingContext();
const lm = await llama.loadModel({ modelPath: root + "models/llm.gguf" });
const lc = await lm.createContext({ contextSize: 4096 });
const emb = async (t) => { const { vector } = await ec.getEmbeddingFor(t); const n = Math.hypot(...vector); return Array.from(vector, (v) => v / n); };
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["道に迷った", "もうすぐ暗くなる", "クマに出会った", "電波がなくて助けを呼べない"];
for (const q of qs) {
  const qv = await emb(config.queryPrefix + q);
  const used = index.chunks.map((c) => ({ c, s: dot(c.vector, qv) })).sort((a, b) => b.s - a.s).slice(0, config.topK).filter((h) => h.s >= config.minScore);
  const context = used.map((h) => fill(config.contextTemplate, { title: h.c.title, text: h.c.text })).join("\n\n");
  const seq = lc.getSequence();
  const sess = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.systemPrompt });
  const t = Date.now();
  const out = await sess.prompt(fill(config.userTemplate, { context, question: q }), config.generation);
  seq.dispose();
  console.log(`\n### ${q} (${Date.now() - t}ms)`);
  for (const line of out.split("\n").map((l) => l.replace(/^\s*[・\-*•]\s*/, "").trim()).filter(Boolean).slice(0, 5)) {
    const v = await emb(config.similarityPrefix + line);
    let best = null;
    for (const h of used) h.c.sentenceVectors.forEach((sv, i) => { const s = dot(sv, v); if (!best || s > best.s) best = { s, c: h.c, i }; });
    console.log(`  ・${line}\n      ${best.s.toFixed(2)} ${best.s >= config.copyMinScore ? "→" : "×"} ［${best.c.title}］${best.c.sentences[best.i].slice(0, 40)}`);
  }
}
