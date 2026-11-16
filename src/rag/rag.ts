// 「質問 → 検索 → 答え」の流れ。
//
// 答えは 2 段構え：
// 1. 資料の要点（AI を使わない）：いちばん近い項目の要点を原文のまま全部と、
//    ほかの項目から「あわせて確認」する行。一瞬で出て、作り話は原理的に出ない。
// 2. AI の短いまとめ（ボタンを押したときだけ）：小さな LLM が要約し、各行に近い原文の番号を付ける。
//
// 1.2B の LLM は資料にない内容を付け足すことがあり、それを自動で見分けられなかったので
// （scripts/eval-cite.mjs）、メインの答えは原文にしている。
import config from './config.json';
import indexJson from '../../assets/rag/index.json';
import synonyms from '../../data/synonyms.json';
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

/** 言い換えの辞書（data/synonyms.json）で、検索用の文に言葉を足す */
export function expandQuery(question: string): string {
  const adds = Object.entries(synonyms.words as Record<string, string>)
    .filter(([k]) => question.includes(k))
    .map(([, v]) => v);
  return adds.length ? `${question} ${[...new Set(adds.join(' ').split(' '))].join(' ')}` : question;
}

export async function search(question: string, engine: Engine, store: VectorStore): Promise<SearchResult> {
  const t0 = Date.now();
  const expanded = expandQuery(question);
  const qv = normalize(await engine.embed(config.queryPrefix + expanded));
  const t1 = Date.now();
  const hits = await store.search(qv, Math.max(config.topK, 4));
  const used = hits.slice(0, config.topK).filter((h) => h.score >= config.minScore);
  const top = used[0] ?? null;

  let extras: ExtraLine[] = [];
  if (top && used.length > 1) {
    const sv = normalize(await engine.embed(config.similarityPrefix + expanded));
    // 「あわせて確認」は、マニュアルで関連として指定した資料からだけ選ぶ
    // （ベクトルが近いだけだと「寒い」に熱中症の「体を冷やす」が混ざるなど、逆の内容が出ることがあるため）
    extras = used
      .slice(1)
      .filter((h) => top.chunk.related.includes(h.chunk.id))
      .flatMap((h) => h.chunk.sentenceVectors.map((v, i) => ({ chunk: h.chunk, lineIndex: i, score: dot(v, sv) })))
      .filter((x) => x.score >= config.extraMinScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, config.extraMax);
  }
  const weak = !!top && top.score < config.weakScore;
  const urgent = config.emergencyWords.some((w) => question.includes(w));
  return { question, hits, used, top, extras, weak, urgent, timings: { embedMs: t1 - t0, searchMs: Date.now() - t1 } };
}

export type Citation = { chunk: Chunk; lineIndex: number; score: number };
export type SummaryLine = { text: string; citation: Citation | null };
export type SummaryResult = {
  lines: SummaryLine[];
  timings: { generateMs: number; tokens: number; tokensPerSecond: number };
};

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/** AI の短いまとめ。各行に、いちばん近い原文の行を出典として付ける。 */
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
  const texts = res.text
    .split('\n')
    .map((l) => l.replace(/^\s*[・\-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const lines: SummaryLine[] = [];
  for (const text of texts) {
    const v = normalize(await engine.embed(config.similarityPrefix + text));
    let best: Citation | null = null;
    for (const h of result.used) {
      h.chunk.sentenceVectors.forEach((sv, i) => {
        const score = dot(sv, v);
        if (!best || score > best.score) best = { chunk: h.chunk, lineIndex: i, score };
      });
    }
    const citation = best as Citation | null;
    lines.push({ text, citation: citation && citation.score >= config.citeMinScore ? citation : null });
  }
  return { lines, timings: { generateMs, tokens: res.tokens, tokensPerSecond: res.tokensPerSecond } };
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
