// web 用のエンジン（Claude が動作確認に使う）。速さは参考にならない。
// モデルは scripts/serve-web.mjs が /models/ で配信する。
import { Wllama } from '@wllama/wllama';
import type { ChatMessage, Engine, GenerateOptions, GenerateResult } from './types';

const WASM = { default: '/wllama/wllama.wasm' };

class WebEngine implements Engine {
  readonly name = 'wllama';
  private llm: Wllama | null = null;
  private emb: Wllama | null = null;

  async loadEmbed(onProgress?: (ratio: number) => void) {
    if (this.emb) return;
    const emb = new Wllama(WASM);
    await emb.loadModelFromUrl('/models/embed.gguf', {
      embeddings: true,
      n_ctx: 512,
      useCache: false,
      progressCallback: ({ loaded, total }) => onProgress?.(loaded / total),
    });
    this.emb = emb;
  }

  async loadLlm(onProgress?: (ratio: number) => void) {
    if (this.llm) return;
    const llm = new Wllama(WASM);
    await llm.loadModelFromUrl('/models/llm.gguf', {
      n_ctx: 4096,
      useCache: false,
      progressCallback: ({ loaded, total }) => onProgress?.(loaded / total),
    });
    this.llm = llm;
  }

  async embed(text: string) {
    if (!this.emb) throw new Error('embedding モデルが読み込まれていません');
    const res = await this.emb.createEmbedding({ input: text });
    const v = res.data[0].embedding;
    if (typeof v === 'string') throw new Error('embedding が base64 で返ってきました');
    return v;
  }

  async generate(
    messages: ChatMessage[],
    options: GenerateOptions,
    onToken?: (accumulated: string) => void,
  ): Promise<GenerateResult> {
    if (!this.llm) throw new Error('LLM が読み込まれていません');
    let acc = '';
    let tokens = 0;
    let tps = 0;
    await this.llm.createChatCompletion({
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
      onData: (chunk) => {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          acc += delta;
          onToken?.(acc);
        }
        if (chunk.timings) {
          tokens = chunk.timings.predicted_n;
          tps = chunk.timings.predicted_per_second;
        }
      },
    });
    return { text: acc, tokens, tokensPerSecond: tps };
  }
}

export function createEngine(): Engine {
  return new WebEngine();
}
