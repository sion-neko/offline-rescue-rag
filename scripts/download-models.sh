#!/usr/bin/env bash
# モデル（GGUF）を models/ にダウンロードする。
# git には入れない（.gitignore 済み）。EAS Build でもこのスクリプトを実行する。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models

download() {
  local url="$1" out="models/$2"
  if [ -s "$out" ]; then
    echo "skip: $out"
    return
  fi
  echo "download: $out"
  curl -fL --retry 4 --retry-delay 5 -o "$out.part" "$url"
  mv "$out.part" "$out"
}

# 生成用 LLM：LFM2.5-1.2B-JP-202606（Q4_K_M, 約730MB, LFM Open License v1.0）
download "https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606-GGUF/resolve/main/LFM2.5-1.2B-JP-202606-Q4_K_M.gguf" "llm.gguf"
download "https://huggingface.co/LiquidAI/LFM2.5-1.2B-JP-202606-GGUF/resolve/main/LICENSE" "LICENSE-LFM.txt"

# 検索用 embedding：EmbeddingGemma-300m（QAT Q8_0, 約330MB, Gemma 利用規約）
# e5-small / ruri-v3 と比べて、関係ない文との点数差がいちばん大きかったので採用。
download "https://huggingface.co/ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/resolve/main/embeddinggemma-300m-qat-Q8_0.gguf" "embed.gguf"
