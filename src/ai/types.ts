// LLM と embedding をまとめて扱う「エンジン」の共通の形。
// iPhone では llama.rn（engine.native.ts）、web では wllama（engine.web.ts）が中身になる。

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GenerateOptions = {
  maxTokens: number;
  temperature: number;
};

export type GenerateResult = {
  text: string;
  /** 生成したトークン数 */
  tokens: number;
  /** 1 秒あたりの生成トークン数（速さの目安） */
  tokensPerSecond: number;
};

export interface Engine {
  /** どの実装か（デバッグ表示用） */
  readonly name: string;
  /** 検索用の embedding モデルを読み込む（小さいので先に読む） */
  loadEmbed(onProgress?: (ratio: number) => void): Promise<void>;
  /** 要約用の LLM を読み込む */
  loadLlm(onProgress?: (ratio: number) => void): Promise<void>;
  embed(text: string): Promise<number[]>;
  generate(
    messages: ChatMessage[],
    options: GenerateOptions,
    onToken?: (accumulated: string) => void,
  ): Promise<GenerateResult>;
}
