// 条件が重なる質問（想定外の質問）で、要約 LLM の答え方を比べる。
// アプリと同じ検索で候補の資料を選び、LLM に答えさせ、答えを 1 文ずつに分けて、いちばん近い候補の行と点数を出す。
// 判定（正しい／意味が変わった／資料にない）は人が付ける。
// 使い方: node scripts/eval-compose.mjs <出力.json> [プロンプトを上書きする JSON]
//   上書き JSON の flatLines が true なら、資料の題名を付けずに候補の行を「・」で並べて渡す
import { readFileSync, writeFileSync } from "node:fs";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "node:url";

const [outPath, overridePath] = process.argv.slice(2);
const root = fileURLToPath(new URL("..", import.meta.url));
const config = {
  ...JSON.parse(readFileSync(root + "src/rag/config.json", "utf8")),
  ...(overridePath ? JSON.parse(readFileSync(overridePath, "utf8")) : {}),
};
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const syn = JSON.parse(readFileSync(root + "data/synonyms.json", "utf8")).words;

const QUESTIONS = [
  "道に迷って、もうすぐ暗くなりそう",
  "雨で濡れて寒いし、電波も入らない",
  "仲間がけがをして動けない。電波も入らない",
  "道に迷ったうえに、霧で前が見えない",
  "山で夜を明かすことになったけど、スマホの電池が少ない",
  "救助を呼んだけど、寒くて震えが止まらない",
  "暑くて足がつったし、水もなくなった",
  "雷が鳴ってきたけど、道が分からない",
];

const expand = (q) => {
  const a = Object.entries(syn).filter(([k]) => q.includes(k)).map(([, v]) => v);
  return a.length ? `${q} ${[...new Set(a.join(" ").split(" "))].join(" ")}` : q;
};
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const llama = await getLlama({ gpu: false });
const em = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ec = await em.createEmbeddingContext();
const emb = async (t) => {
  const { vector } = await ec.getEmbeddingFor(t);
  const n = Math.hypot(...vector);
  return Array.from(vector, (v) => v / n);
};
const lm = await llama.loadModel({ modelPath: root + "models/llm.gguf" });
const lc = await lm.createContext({ contextSize: 4096 });

const topK = config.composeTopK ?? config.topK;
const results = [];
for (const q of QUESTIONS) {
  const qv = await emb(config.queryPrefix + expand(q));
  const hits = index.chunks.map((c) => ({ c, s: dot(c.vector, qv) })).sort((a, b) => b.s - a.s);
  const used = hits.slice(0, topK).filter((h) => h.s >= config.minScore);
  const context = config.flatLines
    ? used.flatMap((h) => h.c.sentences.map((x) => `・${x}`)).join("\n")
    : used.map((h) => fill(config.contextTemplate, { title: h.c.title, text: h.c.text })).join("\n\n");

  const seq = lc.getSequence();
  const sess = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.systemPrompt });
  const t = Date.now();
  const raw = await sess.prompt(fill(config.userTemplate, { context, question: q }), {
    ...config.generation,
    budgets: { thoughtTokens: 0 },
  });
  const ms = Date.now() - t;
  seq.dispose();
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 文章でも箇条書きでも比べられるよう、改行と「。」で 1 文ずつに分ける
  const parts = text
    .split(/\n|(?<=。)/)
    .map((x) => x.replace(/^\s*([・\-*•]|\d+[.)．])\s*/, "").trim())
    .filter(Boolean);
  const lines = [];
  for (const p of parts) {
    const v = await emb(config.similarityPrefix + p);
    let best = null;
    for (const h of used)
      h.c.sentences.forEach((s, i) => {
        const score = dot(h.c.sentenceVectors[i], v);
        if (!best || score > best.score) best = { score, title: h.c.title, source: s };
      });
    lines.push({ text: p, ...best });
  }
  results.push({ question: q, sources: used.map((h) => h.c.title), ms, raw: text, lines });
  console.log(`### ${q} (${ms}ms) 候補: ${used.map((h) => h.c.title).join(" / ")}`);
  console.log(text.replace(/^/gm, "  | "));
  for (const l of lines) console.log(`  ${l.score.toFixed(2)} ${l.text}\n       ← ［${l.title}］${l.source}`);
}
writeFileSync(outPath, JSON.stringify({ override: overridePath ?? null, results }, null, 2));
