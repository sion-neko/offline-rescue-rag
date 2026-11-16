export type Chunk = {
  id: string;
  source: string;
  title: string;
  text: string;
  vector: number[];
};

export type RagIndex = {
  embedModel: string;
  dim: number;
  chunks: Chunk[];
};

export type Hit = { chunk: Chunk; score: number };

export interface VectorStore {
  readonly name: string;
  init(index: RagIndex): Promise<void>;
  /** score はコサイン類似度（1 に近いほど似ている） */
  search(query: number[], k: number): Promise<Hit[]>;
}
