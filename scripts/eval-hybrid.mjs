// ハイブリッド方式：一番合う項目の要点（行）はそのまま全部出し、
// 2 番目以降の項目からは「あわせて」読むべき行を AI に選ばせる。比較用に、ベクトルの近さだけで選ぶ方法も出す。
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
const qs = process.argv.slice(2).length ? process.argv.slice(2) : ["道がわからなくなった", "もうすぐ暗くなる", "寒くて震えが止まらない", "電波がない時に助けを呼ぶには", "友達が足をくじいた", "雨で体が濡れて寒い"];
for (const q of qs) {
  const qv = await emb(config.queryPrefix + q);
  const hits = index.chunks.map((c) => ({ c, s: dot(c.vector, qv) })).sort((a, b) => b.s - a.s);
  const used = hits.slice(0, config.topK).filter((h) => h.s >= config.minScore);
  const [top, ...rest] = used;
  console.log(`\n### ${q}\n【${top.c.title}】`);
  top.c.sentences.forEach((s) => console.log("  ・" + s));
  const cand = [];
  rest.forEach((h) => h.c.sentences.forEach((s, i) => cand.push({ s, title: h.c.title, v: h.c.sentenceVectors[i] })));
  if (!cand.length) continue;
  // ベクトルの近さ
  const sv = await emb(config.similarityPrefix + q);
  const byVec = cand.map((x) => ({ ...x, sc: dot(x.v, sv) })).sort((a, b) => b.sc - a.sc).slice(0, 2);
  console.log("  [ベクトル] " + byVec.map((x) => `${x.sc.toFixed(2)} ${x.s.slice(0, 30)}（${x.title}）`).join(" | "));
  // AI
  const numbered = cand.map((x, i) => `${i + 1}. ${x.s}`).join("\n");
  const seq = lc.getSequence();
  const sess = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.selectSystemPrompt });
  const a = await sess.prompt(config.selectUserTemplate.replace("{sentences}", numbered).replaceAll("{question}", q), { maxTokens: 20, temperature: 0 });
  const nums = [...new Set((a.match(/\d+/g) ?? []).map(Number))].filter((n) => n >= 1 && n <= cand.length).slice(0, 2);
  console.log("  [AI] " + nums.map((n) => `${cand[n - 1].s.slice(0, 30)}（${cand[n - 1].title}）`).join(" | "));
  seq.dispose();
}
