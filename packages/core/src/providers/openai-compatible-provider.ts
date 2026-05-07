import type { ChatOptions, Chunk, Message, Model, ProviderId } from "@deepcode/shared";
import { ProviderError } from "../errors.js";
import { parseSse } from "./sse.js";
import { toProviderMessages, type LLMProvider, type ProviderCapabilities, type ProviderConfig } from "./provider.js";

export interface OpenAICompatibleProviderOptions {
  id: ProviderId;
  name: string;
  defaultBaseUrl: string;
  defaultModel?: string;
  config: ProviderConfig;
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    jsonMode: true,
    vision: false,
    maxContextLength: 128_000,
  };

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly defaultModel?: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.id = options.id;
    this.name = options.name;
    this.baseUrl = options.config.baseUrl ?? options.defaultBaseUrl;
    this.apiKey = options.config.apiKey;
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders ?? {};
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<Chunk> {
    this.requireApiKey();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: options.signal,
      body: JSON.stringify({
        model: this.resolveModel(options.model),
        messages: toProviderMessages(messages),
        tools: options.tools,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });
    await this.assertOk(response);

    const pendingTools = new Map<number, { id: string; name: string; argumentsJson: string }>();
    for await (const event of parseSse(response)) {
      const choice = event.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) {
        yield { type: "delta", content: delta.content };
      }
      for (const call of delta?.tool_calls ?? []) {
        const index = Number(call.index ?? pendingTools.size);
        const existing = pendingTools.get(index) ?? {
          id: call.id ?? `tool_${index}`,
          name: "",
          argumentsJson: "",
        };
        existing.id = call.id ?? existing.id;
        existing.name += call.function?.name ?? "";
        existing.argumentsJson += call.function?.arguments ?? "";
        pendingTools.set(index, existing);
      }
      if (choice?.finish_reason === "tool_calls") {
        for (const [index, call] of pendingTools) {
          if (!call.name) continue;
          yield {
            type: "tool_call",
            call: {
              id: call.id || `tool_${index}`,
              name: call.name,
              arguments: parseToolArguments(call.argumentsJson),
            },
          };
        }
        pendingTools.clear();
      }
    }
    for (const [index, call] of pendingTools) {
      if (!call.name) continue;
      yield {
        type: "tool_call",
        call: {
          id: call.id || `tool_${index}`,
          name: call.name,
          arguments: parseToolArguments(call.argumentsJson),
        },
      };
    }
    yield { type: "done" };
  }

  async complete(prompt: string, options: Omit<ChatOptions, "tools"> = {}): Promise<string> {
    let output = "";
    const messages: Message[] = [
      { id: "complete-user", role: "user", content: prompt, createdAt: new Date().toISOString() },
    ];
    for await (const chunk of this.chat(messages, options)) {
      if (chunk.type === "delta") output += chunk.content;
    }
    return output;
  }

  async listModels(): Promise<Model[]> {
    this.requireApiKey();
    const response = await fetch(`${this.baseUrl}/models`, { headers: this.headers() });
    await this.assertOk(response);
    const payload = (await response.json()) as any;
    return (payload.data ?? []).map((model: any) => ({
      id: model.id,
      name: model.name ?? model.id,
      provider: this.id,
      contextLength: model.context_length ?? this.capabilities.maxContextLength,
      capabilities: {
        streaming: true,
        functionCalling: true,
        jsonMode: true,
        vision: Boolean(model.architecture?.modality?.includes?.("image")),
      },
      pricing: model.pricing
        ? {
            inputPer1k: Number(model.pricing.prompt ?? 0) * 1000,
            outputPer1k: Number(model.pricing.completion ?? 0) * 1000,
          }
        : undefined,
    }));
  }

  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  private headers(): HeadersInit {
    this.requireApiKey();
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
      ...this.extraHeaders,
    };
  }

  private requireApiKey(): void {
    if (!this.apiKey) {
      throw new ProviderError(`Missing API key for ${this.name}`, this.id);
    }
  }

  private resolveModel(model?: string): string {
    const resolved = model ?? this.defaultModel;
    if (!resolved) {
      throw new ProviderError(`No model configured for ${this.name}. Set defaultModel in .deepcode/config.json.`, this.id);
    }
    return resolved;
  }

  private async assertOk(response: Response): Promise<void> {
    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(`${this.name} request failed: ${response.status} ${body}`, this.id);
    }
  }
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
