// AI のまとめの各行に、どの資料のどの文が対応するか（出典番号）を付けられるか確かめる。
// 資料にない付け足しの行は、点数が低くなるはず。
import { readFileSync } from "node:fs";
import { getLlama } from "node-llama-cpp";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const index = JSON.parse(readFileSync(root + "assets/rag/index.json", "utf8"));
const llama = await getLlama({ gpu: false });
const m = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const c = await m.createEmbeddingContext();
const emb = async (t) => { const { vector } = await c.getEmbeddingFor(t); const n = Math.hypot(...vector); return Array.from(vector, (v) => v / n); };
const cases = [
  ["クマに出会ったとき", ["クマに遭遇したら走らず、ゆっくり後ずさる。", "クマよけスプレーを手元に準備する。", "クマが近づいたらうつ伏せになり、首の後ろを守る。", "安全な距離を保ち、視覚的刺激を避ける。", "緊急時に備え、事前にスプレー使用法を確認する。", "クマとの距離を最小限に保つ。"]],
  ["日没が近いとき・暗くなったとき", ["日没前に明るい場所で動きを停止し、安全を確保する。", "ヘッドランプ使用時は道の確認を怠らず、暗闇での歩行を避ける。", "安全な平地を選び、沢や危険地帯を回避する。", "朝の明るい時間まで待ってから、再び行動を開始する。", "テントを張って休む。"]],
  ["低体温症を防ぐ", ["濡れた服をすぐに脱ぎ、乾いた衣服で体温を回復する。", "帽子・手袋・雨具で頭部・四肢を徹底的に覆う。", "アルコール摂取を避け、体温低下を防ぐ。", "カイロで体を温める。"]],
];
for (const [title, bullets] of cases) {
  const ch = index.chunks.find((x) => x.title === title);
  console.log("##", title);
  for (const b of bullets) {
    const v = await emb(config.similarityPrefix + b);
    let best = { s: -1, i: -1 };
    ch.sentenceVectors.forEach((sv, i) => { const s = sv.reduce((a, x, k) => a + x * v[k], 0); if (s > best.s) best = { s, i }; });
    console.log(best.s.toFixed(3), b, "→", ch.sentences[best.i]);
  }
}
