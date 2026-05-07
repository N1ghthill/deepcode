import type { ChatOptions, Chunk, DeepCodeConfig, Message, ProviderId } from "@deepcode/shared";
import { ProviderError } from "../errors.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { OpenAICompatibleProvider } from "./openai-compatible-provider.js";
import type { LLMProvider } from "./provider.js";

export class ProviderManager {
  private readonly providers = new Map<ProviderId, LLMProvider>();

  constructor(config: DeepCodeConfig) {
    this.register(
      new OpenAICompatibleProvider({
        id: "openrouter",
        name: "OpenRouter",
        defaultBaseUrl: "https://openrouter.ai/api/v1",
        defaultModel: config.defaultModel,
        config: config.providers.openrouter,
        extraHeaders: {
          "HTTP-Referer": "https://deepcode.local",
          "X-Title": "DeepCode",
        },
      }),
    );
    this.register(new AnthropicProvider(config.providers.anthropic));
    this.register(
      new OpenAICompatibleProvider({
        id: "openai",
        name: "OpenAI",
        defaultBaseUrl: "https://api.openai.com/v1",
        defaultModel: config.defaultModel,
        config: config.providers.openai,
      }),
    );
    this.register(
      new OpenAICompatibleProvider({
        id: "deepseek",
        name: "DeepSeek",
        defaultBaseUrl: "https://api.deepseek.com/v1",
        defaultModel: config.defaultModel,
        config: config.providers.deepseek,
      }),
    );
    this.register(
      new OpenAICompatibleProvider({
        id: "opencode",
        name: "OpenCode",
        defaultBaseUrl: config.providers.opencode.baseUrl ?? "https://api.opencode.ai/v1",
        defaultModel: config.defaultModel,
        config: config.providers.opencode,
      }),
    );
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): LLMProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new ProviderError(`Provider not registered: ${id}`, id);
    return provider;
  }

  async *chat(
    messages: Message[],
    options: ChatOptions & { preferredProvider: ProviderId; failover?: ProviderId[] },
  ): AsyncIterable<Chunk> {
    const order = [options.preferredProvider, ...(options.failover ?? [])].filter(
      (provider, index, list) => list.indexOf(provider) === index,
    );
    let lastError: unknown;
    for (const providerId of order) {
      try {
        const provider = this.get(providerId);
        for await (const chunk of provider.chat(messages, options)) {
          yield chunk;
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw new ProviderError("All configured providers failed", options.preferredProvider, lastError);
  }
}
