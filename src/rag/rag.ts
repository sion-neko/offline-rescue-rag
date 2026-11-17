// 「質問 → 検索 → 答え」の流れ。
//
// 原本は QA（data/qa/*.md）。検索は、質問を原本の QA の質問・言い換えと比べる。
//
// 答えは 2 段構え：
// 1. AI が選んだ要点（画面の先頭）：LLM（LFM3-1.7B）に「資料の文をそのまま書き写して」と頼み、
//    書いた行のうち原文の行とほぼ一致するもの（近さ copyMinScore 以上）だけを残す。
//    画面には LLM の文ではなく、一致した原文の行そのものを出すので、意味が変わることはない。
// 2. いちばん近い QA の答え（原本）：AI の選び漏れがあっても見えるよう、その下に全部出す。
//    AI の準備中や失敗時も、こちらは一瞬で出る。
//
// LLM に自由に要約させると、意味を変えたり資料にないことを書いたりしたため、この形にした
// （docs/llm-comparison.md）。
import config from './config.json';
import indexJson from '../../assets/rag/index.json';
import type { Engine } from '../ai/types';
import type { Chunk, Glossary, Hit, RagIndex, VectorStore } from './types';
import { dot, normalize } from './vector';

export const ragIndex = indexJson as RagIndex;
export const ragConfig = config;

export function getChunk(id: string): Chunk | undefined {
  return ragIndex.chunks.find((c) => c.id === id);
}

export function glossary(): Glossary[] {
  return ragIndex.glossary;
}

export type ExtraLine = { chunk: Chunk; lineIndex: number; score: number };

export type SearchResult = {
  question: string;
  hits: Hit[];
  /** 閾値を超えた項目（多くて topK 件） */
  used: Hit[];
  /** いちばん近い項目。なければ null（資料にない質問） */
  top: Hit | null;
  /** ほかの項目から「あわせて確認」する行 */
  extras: ExtraLine[];
  /** いちばん近い項目でも、関係が薄いかもしれない（点数が weakScore 未満） */
  weak: boolean;
  /** 「助けて」「救助」など、すぐ通報したほうがよさそうな言葉が入っている */
  urgent: boolean;
  timings: { embedMs: number; searchMs: number };
};

export async function search(question: string, engine: Engine, store: VectorStore): Promise<SearchResult> {
  const t0 = Date.now();
  // 原本の QA の質問・言い換えと比べる（docs/retrieval-comparison.md の C）。
  // 言い換えは原本に書くので、言い換えの辞書（data/synonyms.json）は使わない
  const qv = normalize(await engine.embed(config.similarityPrefix + question));
  const t1 = Date.now();
  const hits = await store.search(qv, Math.max(config.topK, 4));
  const first = hits[0] && hits[0].score >= config.minScore ? hits[0] : null;
  // 条件が重なる質問（「雨で寒いし、電波もない」）では、条件ごとの QA が上位に並ぶ。
  // 1 位から離れすぎた QA は、数合わせになるので使わない
  const used = first
    ? hits.slice(0, config.topK).filter((h) => h.score >= config.minScore && h.score >= first.score - config.usedMaxGap)
    : [];
  const top = used[0] ?? null;

  // 「あわせて確認」：2 位以下の QA の答え（条件が重なる質問の、もう片方の条件）
  const extras: ExtraLine[] = used
    .slice(1)
    .flatMap((h) => h.chunk.sentences.map((_, i) => ({ chunk: h.chunk, lineIndex: i, score: h.score })));
  const weak = !!top && top.score < config.weakScore;
  const urgent = config.emergencyWords.some((w) => question.includes(w));
  return { question, hits, used, top, extras, weak, urgent, timings: { embedMs: t1 - t0, searchMs: Date.now() - t1 } };
}

export type Citation = { chunk: Chunk; lineIndex: number; score: number };
export type SummaryResult = {
  /** AI が選んだ原文の行（大事な順） */
  picks: Citation[];
  /** 原文と一致しなかったので捨てた行の数 */
  dropped: number;
  timings: { generateMs: number; tokens: number; tokensPerSecond: number };
};

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** LLM の出力の 1 行から、行頭の記号・番号・「題名：」を取り除く */
function cleanLine(line: string): string {
  let x = line;
  for (let k = 0; k < 3; k++) x = x.replace(/^\s*([・\-*•]|\d+[.)．])\s*/, '').trim();
  for (const c of ragIndex.chunks) {
    if (x.startsWith(c.title + '：') || x.startsWith(c.title + ':')) x = x.slice(c.title.length + 1).trim();
  }
  return x;
}

/** AI に、資料から質問に合う行を選ばせる。原文の行とほぼ一致した行だけを、原文のまま返す。 */
export async function summarize(
  result: SearchResult,
  engine: Engine,
  onText?: (text: string) => void,
): Promise<SummaryResult> {
  const t0 = Date.now();
  const context = result.used
    .map((h) => fill(config.contextTemplate, { title: h.chunk.title, text: h.chunk.text }))
    .join('\n\n');
  const res = await engine.generate(
    [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: fill(config.userTemplate, { context, question: result.question }) },
    ],
    config.generation,
    onText,
  );
  const generateMs = Date.now() - t0;
  const texts = res.text.split('\n').map(cleanLine).filter(Boolean);

  const picks: Citation[] = [];
  let dropped = 0;
  for (const text of texts) {
    const v = normalize(await engine.embed(config.similarityPrefix + text));
    let best: Citation | null = null;
    for (const h of result.used) {
      h.chunk.sentenceVectors.forEach((sv, i) => {
        const score = dot(sv, v);
        if (!best || score > best.score) best = { chunk: h.chunk, lineIndex: i, score };
      });
    }
    const b = best as Citation | null;
    if (!b || b.score < config.copyMinScore) {
      dropped += 1;
      continue;
    }
    if (picks.some((p) => p.chunk.id === b.chunk.id && p.lineIndex === b.lineIndex)) continue;
    if (picks.length < config.summaryMax) picks.push(b);
  }
  return { picks, dropped, timings: { generateMs, tokens: res.tokens, tokensPerSecond: res.tokensPerSecond } };
}

/** 目次用：分類ごとにまとめる（マニュアルに書いた順） */
export function contents(): { category: string; chunks: Chunk[] }[] {
  const groups: { category: string; chunks: Chunk[] }[] = [];
  for (const c of ragIndex.chunks) {
    let g = groups.find((x) => x.category === c.category);
    if (!g) groups.push((g = { category: c.category, chunks: [] }));
    g.chunks.push(c);
  }
  return groups;
}
