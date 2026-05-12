import type { Chunk, Message, Model, ProviderId } from "@deepcode/shared";
import { ProviderError } from "../errors.js";
import { redactText } from "../security/secret-redactor.js";
import { parseSse } from "./sse.js";
import {
  toOpenAICompatibleMessages,
  type LLMProvider,
  type ProviderChatOptions,
  type ProviderCapabilities,
  type ProviderConfig,
} from "./provider.js";
import { parseToolArgumentsObject } from "./tool-arguments.js";

export interface OpenAICompatibleProviderOptions {
  id: ProviderId;
  name: string;
  defaultBaseUrl: string;
  defaultModel?: string;
  config: ProviderConfig;
  extraHeaders?: Record<string, string>;
  normalizeModelId?: (model: string) => string;
  buildRequestBody?: (
    body: Record<string, unknown>,
    context: { model: string; options: ProviderChatOptions },
  ) => Record<string, unknown>;
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
  private readonly normalizeModelId?: (model: string) => string;
  private readonly buildRequestBody?: OpenAICompatibleProviderOptions["buildRequestBody"];

  constructor(options: OpenAICompatibleProviderOptions) {
    this.id = options.id;
    this.name = options.name;
    this.baseUrl = options.config.baseUrl ?? options.defaultBaseUrl;
    this.apiKey = options.config.apiKey;
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders ?? {};
    this.normalizeModelId = options.normalizeModelId;
    this.buildRequestBody = options.buildRequestBody;
  }

  async *chat(messages: Message[], options: ProviderChatOptions): AsyncIterable<Chunk> {
    this.requireApiKey();
    const model = this.resolveModel(options.model);
    const requestBody = this.buildRequestBody?.({
      model,
      messages: toOpenAICompatibleMessages(messages),
      tools: options.tools,
      tool_choice: options.tools?.length ? toOpenAICompatibleToolChoice(options.toolChoice) : undefined,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }, { model, options }) ?? {
      model,
      messages: toOpenAICompatibleMessages(messages),
      tools: options.tools,
      tool_choice: options.tools?.length ? toOpenAICompatibleToolChoice(options.toolChoice) : undefined,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    const response = await this.fetchJson(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: options.signal,
      body: JSON.stringify(requestBody),
    });
    await this.assertOk(response);

    const pendingTools = new Map<number, { id: string; name: string; argumentsJson: string }>();
    let lastUsage: { inputTokens: number; outputTokens: number } | null = null;
    for await (const event of parseSse(response)) {
      const streamError = getOpenAICompatibleStreamError(event);
      if (streamError) {
        throw new ProviderError(
          redactText(`${this.name} stream failed: ${streamError}`, this.secretValues()),
          this.id,
        );
      }
      const choice = event.choices?.[0];
      const delta = choice?.delta;
      if (delta?.content) {
        yield { type: "delta", content: delta.content };
      }
      if (typeof delta?.reasoning_content === "string" && delta.reasoning_content.length > 0) {
        yield { type: "reasoning", content: delta.reasoning_content };
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
              arguments: parseToolArgumentsObject(call.argumentsJson),
            },
          };
        }
        pendingTools.clear();
      }
      const usage = event.usage;
      if (usage) {
        lastUsage = {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
        };
      }
    }
    for (const [index, call] of pendingTools) {
      if (!call.name) continue;
      yield {
        type: "tool_call",
        call: {
          id: call.id || `tool_${index}`,
          name: call.name,
          arguments: parseToolArgumentsObject(call.argumentsJson),
        },
      };
    }
    if (lastUsage) {
      yield { type: "usage", inputTokens: lastUsage.inputTokens, outputTokens: lastUsage.outputTokens };
    }
    yield { type: "done" };
  }

  async complete(prompt: string, options: Omit<ProviderChatOptions, "tools"> = {}): Promise<string> {
    let output = "";
    const messages: Message[] = [
      { id: "complete-user", role: "user", content: prompt, createdAt: new Date().toISOString() },
    ];
    for await (const chunk of this.chat(messages, options)) {
      if (chunk.type === "delta") output += chunk.content;
    }
    return output;
  }

  async listModels(options: { signal?: AbortSignal } = {}): Promise<Model[]> {
    this.requireApiKey();
    const response = await this.fetchJson(`${this.baseUrl}/models`, {
      headers: this.headers(),
      signal: options.signal,
    });
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

  async validateConfig(options: { signal?: AbortSignal } = {}): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.listModels(options);
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
      throw new ProviderError(
        `No model configured for ${this.name}. Set defaultModel/defaultModels in .deepcode/config.json.`,
        this.id,
      );
    }
    return this.normalizeModelId ? this.normalizeModelId(resolved) : resolved;
  }

  private async assertOk(response: Response): Promise<void> {
    if (!response.ok) {
      const body = await response.text();
      throw new ProviderError(
        redactText(formatProviderHttpError(this.name, response.status, body), this.secretValues()),
        this.id,
      );
    }
  }

  private async fetchJson(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (isAbortError(error)) {
        throw new ProviderError(`${this.name} request timed out or was cancelled`, this.id, error);
      }
      const message = `${this.name} network request failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new ProviderError(redactText(message, this.secretValues()), this.id, error);
    }
  }

  private secretValues(): string[] {
    return this.apiKey ? [this.apiKey] : [];
  }
}

function formatProviderHttpError(provider: string, status: number, body: string): string {
  const detail = body.trim().slice(0, 1_000);
  if (status === 401 || status === 403) {
    return `${provider} authentication failed (${status}). Check the configured API key. ${detail}`;
  }
  if (status === 404) {
    return `${provider} request failed (${status}). The provider endpoint or model may not exist. ${detail}`;
  }
  if (status === 400 || status === 422) {
    return `${provider} rejected the request (${status}). Check the configured model and request options. ${detail}`;
  }
  if (status >= 500) {
    return `${provider} service failed (${status}). Try again later. ${detail}`;
  }
  return `${provider} request failed: ${status} ${detail}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getOpenAICompatibleStreamError(event: any): string | undefined {
  if (!event || typeof event !== "object") {
    return undefined;
  }

  const topLevelMessage = event.error?.message;
  if (typeof topLevelMessage === "string" && topLevelMessage.trim().length > 0) {
    return topLevelMessage.trim();
  }

  return event.choices?.[0]?.finish_reason === "error"
    ? "provider reported a mid-stream error"
    : undefined;
}

function toOpenAICompatibleToolChoice(toolChoice?: "auto" | "required" | "none"): string | undefined {
  if (!toolChoice || toolChoice === "auto") {
    return undefined;
  }

  return toolChoice;
}
