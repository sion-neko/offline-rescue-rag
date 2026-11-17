// web 用：件数が少ないので、全件とのコサイン類似度を JS で計算する。
import type { Hit, RagIndex, VectorStore } from './types';
import { dot, normalize } from './vector';

class BruteForceStore implements VectorStore {
  readonly name = 'JS 全件検索';
  private index: RagIndex | null = null;

  async init(index: RagIndex) {
    this.index = index;
  }

  async search(query: number[], k: number): Promise<Hit[]> {
    if (!this.index) throw new Error('検索の準備ができていません');
    const q = normalize(query);
    return this.index.chunks
      .map((chunk) => ({ chunk, score: Math.max(...chunk.questionVectors.map((v) => dot(v, q))) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

export function createStore(): VectorStore {
  return new BruteForceStore();
}
