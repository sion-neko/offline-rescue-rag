/** 原本（data/qa/*.md）の QA 1 つ。title が代表の質問、sentences が答えの行 */
export type Chunk = {
  id: string;
  source: string;
  category: string;
  title: string;
  /** 同じ意味の別の聞き方 */
  aliases: string[];
  /** 検索用：質問と言い換えのベクトル（[0] が title）。いちばん近いものの点数を使う */
  questionVectors: number[][];
  text: string;
  /** 答えの行（1 行 = 1 つの指示、やる順） */
  sentences: string[];
  sentenceVectors: number[][];
  /** 関連する資料の id */
  related: string[];
  /** 質問＋答えのベクトル（関連する資料を自動で選ぶときに使う） */
  vector: number[];
};

export type Glossary = { term: string; aliases: string[]; text: string };

export type RagIndex = {
  embedModel: string;
  dim: number;
  chunks: Chunk[];
  glossary: Glossary[];
};

export type Hit = { chunk: Chunk; score: number };

export interface VectorStore {
  readonly name: string;
  init(index: RagIndex): Promise<void>;
  /** QA ごとに、質問・言い換えのうちいちばん近いものの点数（コサイン類似度）で並べる */
  search(query: number[], k: number): Promise<Hit[]>;
}
