export type Chunk = {
  id: string;
  source: string;
  category: string;
  title: string;
  text: string;
  /** 要点（マニュアルの 1 行 = 1 要点） */
  sentences: string[];
  sentenceVectors: number[][];
  /** 関連する資料の id */
  related: string[];
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
  /** score はコサイン類似度（1 に近いほど似ている） */
  search(query: number[], k: number): Promise<Hit[]>;
}
