// 検索のやり方の比較：どの資料を答えに使うか、資料にない質問を「該当なし」にできるか。
//   A 資料ベクトル：見出しごとの「題名＋本文」のベクトルと比べる（今のアプリ）
//   B 行ごと    ：資料の各行と比べ、いちばん近い行の点数をその資料の点数にする（small-to-big）
//   C QA        ：data/qa.md の質問・言い換えと比べ、近い QA が出典にしている資料を使う
//   D 判断      ：LFM3 に「この資料に取るべき行動が書かれているか」を聞き、「はい」の確率を点数にする
// 使い方: node scripts/eval-retrieval.mjs <出力.json>
// ※ 原本を QA（data/qa/）に移す前の形式（data/manual/ と data/qa.md）で測ったときのもの。今の形式では動かない
//   （結果は docs/retrieval-comparison.md。当時のファイルは git の履歴にある）
import { readFileSync, writeFileSync } from "node:fs";
import { getLlama, resolveChatWrapper } from "node-llama-cpp";
import { fileURLToPath } from "node:url";

const [outPath] = process.argv.slice(2);
const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const syn = JSON.parse(readFileSync(root + "data/synonyms.json", "utf8")).words;
const readText = (p) => readFileSync(root + p, "utf8").replace(/\r\n/g, "\n");

// 資料の短い名前 → 題名
const T = Object.fromEntries(
  [
    ["道", "道に迷ったときの鉄則"], ["現在地", "現在地の確かめ方"], ["日没", "日没が近いとき・暗くなったとき"],
    ["ビバーク", "ビバーク（その場で夜を明かす）"], ["通報", "通報のしかた"], ["電波", "電波が入らないとき"],
    ["電池", "スマホの電池の節約"], ["待つ", "救助を待つあいだ"], ["低体温", "低体温症の予防"], ["熱中症", "熱中症の予防"],
    ["水", "水と食べ物"], ["けが", "けが人が出たとき（応急処置の鉄則）"], ["天気", "天気が崩れたとき"], ["クマ", "クマに出会ったとき"],
  ],
);
// 種類・質問・正解の資料（条件が重なる質問は、正解が 2 つ。資料にない質問は空）
const CASES = [
  ["言い換え", "帰り道がわからなくなった", ["道"]],
  ["言い換え", "日が落ちてきた", ["日没"]],
  ["言い換え", "体がガタガタ震える", ["低体温"]],
  ["言い換え", "携帯が圏外で通じない", ["電波"]],
  ["言い換え", "友達が足をくじいて歩けない", ["けが"]],
  ["言い換え", "雷がゴロゴロ鳴っている", ["天気"]],
  ["言い換え", "頭がくらくらして気持ち悪い", ["熱中症"]],
  ["言い換え", "クマを見かけた", ["クマ"]],
  ["重なる", "道に迷って、もうすぐ暗くなりそう", ["道", "日没"]],
  ["重なる", "雨で濡れて寒いし、電波も入らない", ["低体温", "電波"]],
  ["重なる", "仲間がけがをして動けない。電波も入らない", ["けが", "電波"]],
  ["重なる", "道に迷ったうえに、霧で前が見えない", ["道", "天気"]],
  ["重なる", "山で夜を明かすことになったけど、スマホの電池が少ない", ["ビバーク", "電池"]],
  ["重なる", "救助を呼んだけど、寒くて震えが止まらない", ["低体温", "待つ"]],
  ["重なる", "暑くて足がつったし、水もなくなった", ["熱中症", "水"]],
  ["重なる", "雷が鳴ってきたけど、道が分からない", ["天気", "道"]],
  ["資料にない", "ハチに刺された", []],
  ["資料にない", "蛇にかまれた", []],
  ["資料にない", "スズメバチが飛んでいる", []],
  ["資料にない", "テントが風で飛ばされた", []],
  ["資料にない", "財布をなくした", []],
  ["資料にない", "川で溺れている人がいる", []],
  ["資料にない", "ガスバーナーの火がつかない", []],
  ["資料にない", "登山靴の底がはがれた", []],
].map(([kind, q, ans]) => ({ kind, q, ans: ans.map((a) => T[a]) }));

// --- QA ---
const qas = readText("data/qa.md")
  .replace(/<!--[\s\S]*?-->/g, "")
  .split(/^## /m)
  .slice(1)
  .map((part) => {
    const [question, ...rest] = part.split("\n");
    const lines = rest.map((l) => l.trim()).filter(Boolean);
    const alias = (lines.find((l) => l.startsWith("言い換え:")) ?? "").replace("言い換え:", "").split(/[,、]/).map((s) => s.trim()).filter(Boolean);
    const titles = [...new Set(lines.map((l) => l.match(/\[([^\]]+)\]$/)?.[1]).filter(Boolean))];
    return { question: question.trim(), texts: [question.trim(), ...alias], titles };
  });

const expand = (q) => {
  const a = Object.entries(syn).filter(([k]) => q.includes(k)).map(([, v]) => v);
  return a.length ? `${q} ${[...new Set(a.join(" ").split(" "))].join(" ")}` : q;
};
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

const llama = await getLlama({ gpu: false });
const em = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ec = await em.createEmbeddingContext();
const emb = async (t) => {
  const { vector } = await ec.getEmbeddingFor(t);
  const n = Math.hypot(...vector);
  return Array.from(vector, (v) => v / n);
};
for (const qa of qas) qa.vectors = await Promise.all(qa.texts.map((t) => emb(config.similarityPrefix + t)));

const lm = await llama.loadModel({ modelPath: root + "models/llm.gguf" });
const lctx = await lm.createContext({ contextSize: 2048 });
const seq = lctx.getSequence();
const wrapper = resolveChatWrapper(lm);
const JUDGE = "質問と資料が与えられます。資料に、質問した人がいま取るべき行動が書かれていれば「はい」、書かれていなければ「いいえ」とだけ答えてください。";
const yesTok = lm.tokenize("はい")[0];
const noTok = lm.tokenize("いいえ")[0];
let judgeMs = 0;
let judgeCount = 0;
const judge = async (q, c) => {
  const { contextText } = wrapper.generateContextState({
    chatHistory: [
      { type: "system", text: JUDGE },
      { type: "user", text: `質問: ${q}\n\n資料:\n【${c.title}】\n${c.text}` },
      { type: "model", response: [] },
    ],
  });
  const tokens = contextText.tokenize(lm.tokenizer);
  await seq.clearHistory();
  const t = Date.now();
  const out = await seq.controlledEvaluate([...tokens.slice(0, -1), [tokens.at(-1), { generateNext: { probabilities: true } }]]);
  judgeMs += Date.now() - t;
  judgeCount++;
  const p = out.at(-1).next.probabilities;
  const y = p.get(yesTok) ?? 0;
  const n = p.get(noTok) ?? 0;
  return y / (y + n || 1);
};

const results = [];
for (const c of CASES) {
  const qv = await emb(config.queryPrefix + expand(c.q));
  const sv = await emb(config.similarityPrefix + expand(c.q));
  const sv0 = await emb(config.similarityPrefix + c.q);
  const A = index.chunks.map((ch) => ({ title: ch.title, s: dot(ch.vector, qv) }));
  const B = index.chunks.map((ch) => ({ title: ch.title, s: Math.max(...ch.sentenceVectors.map((v) => dot(v, sv))) }));
  // C は QA ごとの点数。資料の点数は「その資料を出典にしている QA の最高点」
  const qaScores = qas.map((qa) => ({ qa: qa.question, titles: qa.titles, s: Math.max(...qa.vectors.map((v) => dot(v, sv0))) })).sort((a, b) => b.s - a.s);
  const C = index.chunks.map((ch) => ({ title: ch.title, s: Math.max(-1, ...qaScores.filter((x) => x.titles.includes(ch.title)).map((x) => x.s)) }));
  const D = [];
  for (const ch of index.chunks) D.push({ title: ch.title, s: await judge(c.q, ch) });
  const sort = (xs) => xs.sort((a, b) => b.s - a.s);
  results.push({ ...c, A: sort(A), B: sort(B), C: sort(C), topQa: qaScores.slice(0, 3), D: sort(D) });
  process.stderr.write(".");
}

// --- 集計 ---
const short = (t) => Object.entries(T).find(([, v]) => v === t)?.[0] ?? t;
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
for (const m of ["A", "B", "C", "D"]) {
  log(`\n## ${m}`);
  for (const r of results) {
    const top = r[m].slice(0, 3).map((x) => `${short(x.title)} ${x.s.toFixed(2)}`).join(" / ");
    const mark = r.ans.length === 0 ? "　" : r.ans.includes(r[m][0].title) ? "○" : "×";
    log(`${mark} [${r.kind}] ${r.q} → ${top}`);
  }
  // 1 位が正解か（言い換え・重なる）、重なる質問で正解 2 つが上位 3 件に入るか
  const ok1 = results.filter((r) => r.ans.length && r.ans.includes(r[m][0].title)).length;
  const both = results.filter((r) => r.kind === "重なる" && r.ans.every((a) => r[m].slice(0, 3).some((x) => x.title === a))).length;
  // 線を 1 本引いて、答えられる 16 問と資料にない 8 問をいちばん正しく分けられる線
  const answerable = results.filter((r) => r.ans.length).map((r) => r[m][0].s);
  const none = results.filter((r) => !r.ans.length).map((r) => r[m][0].s);
  let best = { acc: -1, th: 0 };
  for (const th of [...answerable, ...none].map((s) => s + 1e-9)) {
    const acc = answerable.filter((s) => s >= th).length + none.filter((s) => s < th).length;
    if (acc > best.acc) best = { acc, th };
  }
  log(`1 位が正解 ${ok1}/16、重なる質問で正解 2 つが上位 3 件に ${both}/8`);
  log(`答えられる質問の 1 位の点数 ${Math.min(...answerable).toFixed(2)}〜${Math.max(...answerable).toFixed(2)}、資料にない質問 ${Math.min(...none).toFixed(2)}〜${Math.max(...none).toFixed(2)}`);
  log(`線 1 本で分けたとき ${best.acc}/24 が正しい（線 ${best.th.toFixed(2)}）`);
}
log(`\n判断 1 回の平均 ${(judgeMs / judgeCount).toFixed(0)}ms（この PC の CPU、${judgeCount} 回）`);
log("\n## C の上位の QA");
for (const r of results) log(`[${r.kind}] ${r.q} → ${r.topQa.map((x) => `${x.qa} ${x.s.toFixed(2)}`).join(" / ")}`);
writeFileSync(outPath, JSON.stringify({ results, summary: lines }, null, 2));
