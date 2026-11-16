// 「AI に文の番号を選ばせる」方式を試す。資料の文に番号を振り、質問に関係する番号を選ばせる。
// 表示するのは資料の原文そのものなので、作り話は出ない。
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
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["道がわからなくなった", "もうすぐ暗くなる", "寒くて震えが止まらない", "クマがいる", "電波がない時に助けを呼ぶには", "友達が足をくじいた"];
for (const q of qs) {
  const qv = await emb(config.queryPrefix + q);
  const hits = index.chunks.map((c) => ({ c, s: c.vector.reduce((a, v, i) => a + v * qv[i], 0) })).sort((a, b) => b.s - a.s);
  const used = hits.slice(0, config.topK).filter((h) => h.s >= config.minScore);
  const list = [];
  used.forEach((h) => h.c.sentences.forEach((s) => list.push({ s, title: h.c.title })));
  const numbered = list.map((x, i) => `${i + 1}. ${x.s}`).join("\n");
  const seq = lc.getSequence();
  const sess = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.selectSystemPrompt });
  const t = Date.now();
  const a = await sess.prompt(config.selectUserTemplate.replace("{sentences}", numbered).replaceAll("{question}", q), { maxTokens: 40, temperature: 0 });
  const nums = [...new Set((a.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= list.length).slice(0, config.selectMax);
  console.log(`\n### ${q}  (${Date.now() - t}ms)  raw="${a.trim()}"`);
  nums.forEach((n) => console.log(`  ・${list[n - 1].s}  ［${list[n - 1].title}］`));
  seq.dispose();
}
