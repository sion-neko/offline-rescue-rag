// embedding モデルが検索に使えるか（関係ある文が上に来るか）を確かめる
// 使い方: node scripts/check-embed.mjs <model.gguf> <queryPrefix> <passagePrefix>
import { getLlama } from "node-llama-cpp";
import { fileURLToPath } from "node:url";
const [modelPath = fileURLToPath(new URL("../models/embed.gguf", import.meta.url)), qp = "query: ", pp = "passage: "] = process.argv.slice(2);
const llama = await getLlama({ gpu: false });
const m = await llama.loadModel({ modelPath });
const c = await m.createEmbeddingContext();
const docs = [
  "道に迷ったら、むやみに動かず来た道を引き返す。沢を下ってはいけない。",
  "低体温症を防ぐため、濡れた服は着替え、風を避けて体を冷やさない。",
  "救助要請は110番か119番。圏外なら見晴らしのよい尾根に移動する。",
  "カレーライスの作り方：玉ねぎを炒めてから肉と野菜を煮込む。",
];
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] ** 2; y += b[i] ** 2; } return d / Math.sqrt(x * y); };
const dv = [];
for (const d of docs) dv.push((await c.getEmbeddingFor(pp + d)).vector);
for (const q of ["道がわからなくなった", "寒くて震えが止まらない", "電波がない時に助けを呼ぶには"]) {
  const qv = (await c.getEmbeddingFor(qp + q)).vector;
  console.log(q, "→", docs.map((d, i) => [cos(qv, dv[i]).toFixed(3), d.slice(0, 8)]).sort((a, b) => b[0] - a[0]).map(x => x.join(" ")).join(" | "));
}
