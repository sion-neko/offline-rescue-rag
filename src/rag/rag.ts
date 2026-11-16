// 「質問 → 検索 → 要約」の流れ。プロンプトや閾値は config.json にまとめてあり、
// scripts/eval-rag.mjs（Linux での確認用）と同じ設定を使う。
import config from './config.json';
import indexJson from '../../assets/rag/index.json';
import type { Engine } from '../ai/types';
import type { Hit, RagIndex, VectorStore } from './types';
import { normalize } from './vector';

export const ragIndex = indexJson as RagIndex;
export const ragConfig = config;

export type AnswerResult = {
  hits: Hit[];
  /** 閾値を超えて、要約に使った資料 */
  used: Hit[];
  text: string;
  timings: { embedMs: number; searchMs: number; generateMs: number; tokens: number; tokensPerSecond: number };
};

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

export async function answer(
  question: string,
  engine: Engine,
  store: VectorStore,
  onToken?: (accumulated: string) => void,
): Promise<AnswerResult> {
  const t0 = Date.now();
  const qv = normalize(await engine.embed(config.queryPrefix + question));
  const t1 = Date.now();
  const hits = await store.search(qv, Math.max(config.topK, 4));
  const t2 = Date.now();
  const used = hits.slice(0, config.topK).filter((h) => h.score >= config.minScore);
  const timings = { embedMs: t1 - t0, searchMs: t2 - t1, generateMs: 0, tokens: 0, tokensPerSecond: 0 };

  if (used.length === 0) {
    onToken?.(config.noHitAnswer);
    return { hits, used, text: config.noHitAnswer, timings };
  }

  const context = used
    .map((h) => fill(config.contextTemplate, { title: h.chunk.title, text: h.chunk.text }))
    .join('\n\n');
  const res = await engine.generate(
    [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: fill(config.userTemplate, { context, question }) },
    ],
    config.generation,
    onToken,
  );
  timings.generateMs = Date.now() - t2;
  timings.tokens = res.tokens;
  timings.tokensPerSecond = res.tokensPerSecond;
  return { hits, used, text: res.text.trim(), timings };
}
