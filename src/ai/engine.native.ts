// iPhone 用のエンジン。モデルはアプリに同梱し（plugins/with-bundled-models.js）、
// llama.rn の is_model_asset でアプリ本体の中から読み込む。
import { initLlama, type LlamaContext } from 'llama.rn';
import type { ChatMessage, Engine, GenerateOptions, GenerateResult, LoadProgress } from './types';

class NativeEngine implements Engine {
  readonly name = 'llama.rn';
  private llm: LlamaContext | null = null;
  private emb: LlamaContext | null = null;

  async load(onProgress?: (p: LoadProgress) => void) {
    this.emb ??= await initLlama(
      { model: 'embed.gguf', is_model_asset: true, embedding: true, n_ctx: 512, n_gpu_layers: 99 },
      (p) => onProgress?.({ stage: 'embed', ratio: p / 100 }),
    );
    this.llm ??= await initLlama(
      { model: 'llm.gguf', is_model_asset: true, n_ctx: 4096, n_gpu_layers: 99 },
      (p) => onProgress?.({ stage: 'llm', ratio: p / 100 }),
    );
  }

  async embed(text: string) {
    if (!this.emb) throw new Error('embedding モデルが読み込まれていません');
    const { embedding } = await this.emb.embedding(text);
    return embedding;
  }

  async generate(
    messages: ChatMessage[],
    options: GenerateOptions,
    onToken?: (accumulated: string) => void,
  ): Promise<GenerateResult> {
    if (!this.llm) throw new Error('LLM が読み込まれていません');
    let acc = '';
    const res = await this.llm.completion(
      { messages, n_predict: options.maxTokens, temperature: options.temperature, jinja: true },
      (data) => {
        acc += data.token;
        onToken?.(acc);
      },
    );
    return {
      text: res.text,
      tokens: res.timings.predicted_n,
      tokensPerSecond: res.timings.predicted_per_second,
    };
  }
}

export function createEngine(): Engine {
  return new NativeEngine();
}
