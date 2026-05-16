import type { ModelInfo, ProviderId } from "@deepcode/shared";

const HARDCODED_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  "anthropic/claude-3-5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "anthropic/claude-3-5-haiku": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "anthropic/claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "openai/gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "openai/gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "openai/gpt-4.1": { inputPer1k: 0.002, outputPer1k: 0.008 },
  "openai/gpt-4.1-mini": { inputPer1k: 0.0004, outputPer1k: 0.0016 },
  "deepseek/deepseek-chat": { inputPer1k: 0.00027, outputPer1k: 0.0011 },
  "deepseek/deepseek-reasoner": { inputPer1k: 0.00055, outputPer1k: 0.0022 },
  "deepseek/deepseek-v4": { inputPer1k: 0.00027, outputPer1k: 0.0011 },
  "deepseek/deepseek-v4-flash": { inputPer1k: 0.00014, outputPer1k: 0.00028 },
  "qwen/qwen3-coder": { inputPer1k: 0.0003, outputPer1k: 0.0012 },
  "qwen/qwen-plus": { inputPer1k: 0.0004, outputPer1k: 0.0012 },
  "opencode/kimi-k2.6": { inputPer1k: 0.0003, outputPer1k: 0.0012 },
  "opencode/qwen3.6-plus": { inputPer1k: 0.0004, outputPer1k: 0.0016 },
};

function resolveHardcodedPricing(provider: ProviderId, model: string): { inputPer1k: number; outputPer1k: number } | null {
  const normalized = model.toLowerCase();
  for (const [key, pricing] of Object.entries(HARDCODED_PRICING)) {
    const [keyProvider, ...keyModelParts] = key.split("/");
    const keyModel = keyModelParts.join("/").toLowerCase();
    if (keyProvider === provider && (normalized === keyModel || normalized.includes(keyModel))) {
      return pricing;
    }
  }
  return null;
}

export function getModelPricing(
  models: ModelInfo[],
  provider: ProviderId,
  model: string,
): { inputPer1k: number; outputPer1k: number } {
  const found = models.find(
    (item) => item.provider === provider && (item.id === model || item.name === model),
  );
  if (found?.pricing) return found.pricing;

  const hardcoded = resolveHardcodedPricing(provider, model);
  if (hardcoded) return hardcoded;

  return { inputPer1k: 0, outputPer1k: 0 };
}
