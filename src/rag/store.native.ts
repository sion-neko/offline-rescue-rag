// iPhone 用：op-sqlite＋sqlite-vec でベクトル検索する。
// 同梱の index.json を、初回（または中身が変わったとき）に SQLite へ入れ直す。
// 1 つの QA に、質問と言い換えの数だけ行を入れ、QA ごとにいちばん近い行の点数を使う。
import { open, type DB } from '@op-engineering/op-sqlite';
import type { Hit, RagIndex, VectorStore } from './types';

class SqliteVecStore implements VectorStore {
  readonly name = 'op-sqlite + sqlite-vec';
  private db: DB | null = null;
  private index: RagIndex | null = null;
  /** SQLite の行（rowid）→ QA の番号 */
  private rowToChunk: number[] = [];

  async init(index: RagIndex) {
    this.index = index;
    this.rowToChunk = index.chunks.flatMap((c, i) => c.questionVectors.map(() => i));
    const db = open({ name: 'rag.db' });
    this.db = db;
    // 中身が変わったかを、モデル名・行数・先頭ベクトルの値で判定する
    const first = index.chunks[0]?.questionVectors[0] ?? [];
    const signature = `${index.embedModel}:qa:${this.rowToChunk.length}:${first.slice(0, 4).join(',')}`;
    await db.execute('create table if not exists meta (key text primary key, value text)');
    const cur = await db.execute("select value from meta where key = 'signature'");
    if (cur.rows[0]?.value === signature) return;

    await db.execute('drop table if exists vec_chunks');
    await db.execute(
      `create virtual table vec_chunks using vec0(embedding float[${index.dim}] distance_metric=cosine)`,
    );
    await db.transaction(async (tx) => {
      const vectors = index.chunks.flatMap((c) => c.questionVectors);
      for (let i = 0; i < vectors.length; i++) {
        await tx.execute('insert into vec_chunks(rowid, embedding) values (?, ?)', [i, JSON.stringify(vectors[i])]);
      }
      await tx.execute("insert or replace into meta(key, value) values ('signature', ?)", [signature]);
    });
  }

  async search(query: number[], k: number): Promise<Hit[]> {
    if (!this.db || !this.index) throw new Error('検索の準備ができていません');
    // 行の数は少ない（QA × 言い換え）ので全部取り、QA ごとにいちばん近い行を残す
    const res = await this.db.execute(
      'select rowid, distance from vec_chunks where embedding match ? and k = ? order by distance',
      [JSON.stringify(query), this.rowToChunk.length],
    );
    const best = new Map<number, number>();
    for (const r of res.rows) {
      const i = this.rowToChunk[Number(r.rowid)];
      const score = 1 - Number(r.distance);
      if (!best.has(i)) best.set(i, score);
    }
    return [...best.entries()].slice(0, k).map(([i, score]) => ({ chunk: this.index!.chunks[i], score }));
  }
}

export function createStore(): VectorStore {
  return new SqliteVecStore();
}
