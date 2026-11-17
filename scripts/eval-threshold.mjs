// 「資料にない」と判定する閾値（minScore）を決めるため、関係ある質問・ない質問のいちばん近い点数を並べる。
import { readFileSync } from "node:fs";
import { getLlama } from "node-llama-cpp";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const syn = JSON.parse(readFileSync(root + "data/synonyms.json", "utf8")).words;
const expand = (q) => { const a = Object.entries(syn).filter(([k]) => q.includes(k)).map(([, v]) => v); return a.length ? `${q} ${[...new Set(a.join(" ").split(" "))].join(" ")}` : q; };
const llama = await getLlama({ gpu: false });
const em = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ec = await em.createEmbeddingContext();
const emb = async (t) => { const { vector } = await ec.getEmbeddingFor(t); const n = Math.hypot(...vector); return Array.from(vector, (v) => v / n); };
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sets = {
  関係あり: ["足がつった", "一人で心細い", "水がなくなった", "圏外", "たすけて", "どうしよう", "怖い", "みちにまよった", "お腹すいた", "ヘッドライトない", "道に迷った", "迷った 暗い", "帰り道わからん", "どうしよう道がない", "寒い", "手が冷たい", "暗くなってきた", "電波ない", "圏外", "助けて", "救助を呼びたい", "足をくじいた", "血が出てる", "雷", "雨がすごい", "クマ", "熊がいる", "のどが渇いた", "お腹すいた", "電池がない", "暑い", "頭が痛い 暑い", "夜を越す", "霧で見えない", "どこにいるかわからない"],
  関係なし: ["お腹が痛い", "ハチに刺された", "スマホの機種変更", "カレーの作り方", "富士山の標高", "おすすめの登山靴", "明日の天気予報", "東京駅への行き方", "ラーメン屋", "こんにちは", "ありがとう", "テスト"],
};
for (const [name, qs] of Object.entries(sets)) {
  console.log(`## ${name}`);
  for (const q of qs) {
    const qv = await emb(config.queryPrefix + expand(q));
    const best = index.chunks.map((c) => ({ t: c.title, s: dot(c.vector, qv) })).sort((a, b) => b.s - a.s)[0];
    console.log(`  ${best.s.toFixed(3)} ${q} → ${best.t}`);
  }
}
