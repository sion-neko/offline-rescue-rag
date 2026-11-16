// iPhone 用：op-sqlite＋sqlite-vec でベクトル検索する。
// 同梱の index.json を、初回（または中身が変わったとき）に SQLite へ入れ直す。
import { open, type DB } from '@op-engineering/op-sqlite';
import type { Hit, RagIndex, VectorStore } from './types';

class SqliteVecStore implements VectorStore {
  readonly name = 'op-sqlite + sqlite-vec';
  private db: DB | null = null;
  private index: RagIndex | null = null;

  async init(index: RagIndex) {
    this.index = index;
    const db = open({ name: 'rag.db' });
    this.db = db;
    // 中身が変わったかを、モデル名・件数・先頭ベクトルの値で判定する
    const signature = `${index.embedModel}:${index.chunks.length}:${index.chunks[0]?.vector.slice(0, 4).join(',')}`;
    await db.execute('create table if not exists meta (key text primary key, value text)');
    const cur = await db.execute("select value from meta where key = 'signature'");
    if (cur.rows[0]?.value === signature) return;

    await db.execute('drop table if exists vec_chunks');
    await db.execute(
      `create virtual table vec_chunks using vec0(embedding float[${index.dim}] distance_metric=cosine)`,
    );
    await db.transaction(async (tx) => {
      for (let i = 0; i < index.chunks.length; i++) {
        await tx.execute('insert into vec_chunks(rowid, embedding) values (?, ?)', [
          i,
          JSON.stringify(index.chunks[i].vector),
        ]);
      }
      await tx.execute("insert or replace into meta(key, value) values ('signature', ?)", [signature]);
    });
  }

  async search(query: number[], k: number): Promise<Hit[]> {
    if (!this.db || !this.index) throw new Error('検索の準備ができていません');
    const res = await this.db.execute(
      'select rowid, distance from vec_chunks where embedding match ? and k = ? order by distance',
      [JSON.stringify(query), k],
    );
    return res.rows.map((r) => ({
      chunk: this.index!.chunks[Number(r.rowid)],
      score: 1 - Number(r.distance),
    }));
  }
}

export function createStore(): VectorStore {
  return new SqliteVecStore();
}
