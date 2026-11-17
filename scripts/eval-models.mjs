// 要約用 LLM の比較。アプリと同じ検索（言い換えの辞書つき）とプロンプトで、決まった質問を要約させ、
// 各行に近い原文の行（出典）と点数を付けて JSON に書き出す。判定（正しい／条件が抜けた／意味が変わった／資料にない）は人が付ける。
// 使い方: node scripts/eval-models.mjs <model.gguf> <出力.json> [プロンプトを上書きする JSON]
// 上書き JSON の contextTemplate に {lines} があれば、資料の行に番号を振って渡す
import { readFileSync, writeFileSync } from "node:fs";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { fileURLToPath } from "node:url";

const [modelPath, outPath, overridePath] = process.argv.slice(2);
const root = fileURLToPath(new URL("..", import.meta.url));
const config = {
  ...JSON.parse(readFileSync(root + "src/rag/config.json", "utf8")),
  ...(overridePath ? JSON.parse(readFileSync(overridePath, "utf8")) : {}),
};
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const syn = JSON.parse(readFileSync(root + "data/synonyms.json", "utf8")).words;

const QUESTIONS = [
  "道に迷った",
  "もうすぐ暗くなる",
  "寒くて震えが止まらない",
  "クマに出会った",
  "電波がなくて助けを呼べない",
  "雨で寒い",
  "雷が鳴っている",
  "けが人がいる",
  "足がつった",
  "水がなくなった",
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
const lm = await llama.loadModel({ modelPath });
const lc = await lm.createContext({ contextSize: 4096 });
// 「考える過程」を出すモデル（LFM3・Qwen3.5 など）は、考える過程に使うトークンを 0 にして答えだけを出させる
// （アプリでも考える過程は使わない想定。速さと電池のため）

const results = [];
for (const q of QUESTIONS) {
  const ex = expand(q);
  const qv = await emb(config.queryPrefix + ex);
  const hits = index.chunks.map((c) => ({ c, s: dot(c.vector, qv) })).sort((a, b) => b.s - a.s);
  const used = hits.slice(0, config.topK).filter((h) => h.s >= config.minScore);
  let n = 0;
  const context = used
    .map((h) => fill(config.contextTemplate, { title: h.c.title, text: h.c.text, lines: h.c.sentences.map((x) => `${++n}. ${x}`).join("\n") }))
    .join("\n\n");
  const seq = lc.getSequence();
  const sess = new LlamaChatSession({ contextSequence: seq, systemPrompt: config.systemPrompt });
  // フューショット：例のやりとりを会話の履歴として先に入れておく
  if (config.fewShot?.length) {
    sess.setChatHistory([
      { type: "system", text: config.systemPrompt },
      ...config.fewShot.flatMap((ex) => [
        { type: "user", text: fill(config.userTemplate, { context: ex.context, question: ex.question }) },
        { type: "model", response: [ex.answer] },
      ]),
    ]);
  }
  const t = Date.now();
  let tokens = 0;
  const raw = await sess.prompt(fill(config.userTemplate, { context, question: q }), {
    ...config.generation,
    budgets: { thoughtTokens: 0 },
    onTextChunk: () => (tokens += 1),
  });
  const ms = Date.now() - t;
  seq.dispose();
  // 考える過程（<think>…</think>）を出すモデルがあれば取り除く
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const lines = [];
  // 行頭の記号・番号・「題名：」を取り除く（LFM3 は行の頭に資料の題名を付けることがある）
  const titles = index.chunks.map((c) => c.title);
  const clean = (l) => {
    let x = l;
    for (let k = 0; k < 3; k++) x = x.replace(/^\s*([・\-*•]|\d+[.)．])\s*/, "").trim();
    for (const t of titles) if (x.startsWith(t + "：") || x.startsWith(t + ":")) x = x.slice(t.length + 1).trim();
    return x;
  };
  for (const line of text.split("\n").map(clean).filter(Boolean).slice(0, 6)) {
    const v = await emb(config.similarityPrefix + line);
    let best = null;
    for (const h of used) h.c.sentenceVectors.forEach((sv, i) => {
      const s = dot(sv, v);
      if (!best || s > best.score) best = { score: s, title: h.c.title, source: h.c.sentences[i] };
    });
    lines.push({ text: line, ...best });
  }
  results.push({ question: q, sources: used.map((h) => h.c.title), ms, chunks: tokens, lines });
  console.log(`### ${q} (${ms}ms)`);
  for (const l of lines) console.log(`  ・${l.text}\n      ${l.score.toFixed(2)} ［${l.title}］${l.source}`);
}
writeFileSync(outPath, JSON.stringify({ model: modelPath.split("/").pop(), results }, null, 2));
