// data/manual/*.md と data/glossary.md から、アプリに同梱する索引 assets/rag/index.json を作る。
// - 見出し（## ）ごとに 1 チャンク。検索用のベクトルを付ける
// - チャンクを行（要点）に分け、行ごとのベクトルも付ける
// - チャンクどうしの似ている度合いから「関連する資料」を決めておく（アプリでは AI を使わない）
// - 用語集はそのまま入れる
// 使い方: node scripts/build-index.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { getLlama } from "node-llama-cpp";

const root = new URL("..", import.meta.url).pathname;
const config = JSON.parse(readFileSync(root + "src/rag/config.json", "utf8"));
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
const round = (v) => Math.round(v * 1e4) / 1e4;

// --- マニュアル ---
const chunks = [];
for (const file of readdirSync(root + "data/manual").filter((f) => f.endsWith(".md")).sort()) {
  const source = file.replace(/\.md$/, "");
  const body = stripComments(readFileSync(root + "data/manual/" + file, "utf8"));
  for (const part of body.split(/^## /m).slice(1)) {
    const [title, ...rest] = part.split("\n");
    let category = "その他";
    let relatedTitles = null;
    const lines = rest.filter((line) => {
      const m = line.match(/^分類:\s*(.+)$/);
      if (m) category = m[1].trim();
      const r = line.match(/^関連:\s*(.+)$/);
      if (r) relatedTitles = r[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      return !m && !r;
    });
    const text = lines.join("\n").trim();
    if (!text) continue;
    // マニュアルは 1 行に 1 つの要点を書く決まりなので、行を「要点」の単位にする
    const sentences = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    chunks.push({ id: `${source}-${chunks.length}`, source, category, title: title.trim(), text, sentences, relatedTitles });
  }
}

// 本文の中に、ほかの資料の題名がそのまま入っていたら警告する
// （題名を一括置換したときに、本文まで書き換えてしまった事故を防ぐ）
for (const c of chunks) {
  for (const s of c.sentences) {
    for (const o of chunks) {
      if (o !== c && s.includes(o.title)) console.warn(`警告：「${c.title}」の本文に題名「${o.title}」が入っています → ${s}`);
    }
  }
}

// --- 用語集 ---
const glossary = [];
for (const part of stripComments(readFileSync(root + "data/glossary.md", "utf8")).split(/^## /m).slice(1)) {
  const [term, ...rest] = part.split("\n");
  let aliases = [];
  const lines = rest.filter((line) => {
    const m = line.match(/^別名:\s*(.+)$/);
    if (m) aliases = m[1].split(/[,、]/).map((s) => s.trim()).filter(Boolean);
    return !m;
  });
  glossary.push({ term: term.trim(), aliases, text: lines.join("\n").trim() });
}

// --- ベクトル化 ---
const llama = await getLlama({ gpu: false });
const model = await llama.loadModel({ modelPath: root + "models/embed.gguf" });
const ctx = await model.createEmbeddingContext();
const embed = async (text) => {
  const { vector } = await ctx.getEmbeddingFor(text);
  const n = Math.hypot(...vector);
  return Array.from(vector, (v) => round(v / n));
};
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

for (const c of chunks) {
  c.vector = await embed(config.passagePrefix.replace("{title}", c.title) + c.text);
  c.sentenceVectors = [];
  for (const s of c.sentences) c.sentenceVectors.push(await embed(config.similarityPrefix + s));
}

// 関連する資料：マニュアルの「関連:」があればそれを使い、なければ似ている順に上位を（閾値を超えたものだけ）
for (const c of chunks) {
  if (c.relatedTitles) {
    c.related = c.relatedTitles.map((t) => {
      const o = chunks.find((x) => x.title === t);
      if (!o) throw new Error(`「${c.title}」の関連「${t}」が見つかりません`);
      return o.id;
    });
    delete c.relatedTitles;
    continue;
  }
  delete c.relatedTitles;
  c.related = chunks
    .filter((o) => o !== c)
    .map((o) => ({ id: o.id, score: dot(c.vector, o.vector) }))
    .filter((r) => r.score >= config.relatedMinScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.id);
}

const out = { embedModel: config.embedModel, dim: chunks[0].vector.length, chunks, glossary };
writeFileSync(root + "assets/rag/index.json", JSON.stringify(out));
console.log(`wrote ${chunks.length} chunks, ${chunks.reduce((s, c) => s + c.sentences.length, 0)} sentences, ${glossary.length} terms, dim=${out.dim}`);
for (const c of chunks) console.log(`  ${c.title} → ${c.related.map((id) => chunks.find((o) => o.id === id).title).join(" / ")}`);
