import type { ChatOptions, Chunk, Message, Model } from "@deepcode/shared";
import { ProviderError } from "../errors.js";
import { parseSse } from "./sse.js";
import type { LLMProvider, ProviderCapabilities, ProviderConfig } from "./provider.js";

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic" as const;
  readonly name = "Anthropic";
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    jsonMode: false,
    vision: true,
    maxContextLength: 200_000,
  };

  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<Chunk> {
    this.requireApiKey();
    const system = messages.find((message) => message.role === "system")?.content;
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.resolveModel(options.model),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature,
        system,
        messages: messages
          .filter((message) => message.role !== "system" && message.role !== "tool")
          .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
        tools: options.tools?.map(toAnthropicTool),
        stream: true,
      }),
    });
    await this.assertOk(response);

    const toolBlocks = new Map<number, { id: string; name: string; inputJson: string }>();
    for await (const event of parseSse(response)) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        yield { type: "delta", content: event.delta.text };
      }
      if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
        toolBlocks.set(Number(event.index), {
          id: event.content_block.id,
          name: event.content_block.name,
          inputJson: event.content_block.input ? JSON.stringify(event.content_block.input) : "",
        });
      }
      if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
        const block = toolBlocks.get(Number(event.index));
        if (block) {
          block.inputJson += event.delta.partial_json ?? "";
        }
      }
      if (event.type === "content_block_stop") {
        const block = toolBlocks.get(Number(event.index));
        if (!block) continue;
        toolBlocks.delete(Number(event.index));
        yield {
          type: "tool_call",
          call: {
            id: block.id,
            name: block.name,
            arguments: parseToolInput(block.inputJson),
          },
        };
      }
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
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        "x-api-key": this.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
    });
    await this.assertOk(response);
    const payload = (await response.json()) as any;
    return (payload.data ?? []).map((model: any) => ({
      id: model.id,
      name: model.display_name ?? model.id,
      provider: this.id,
      contextLength: this.capabilities.maxContextLength,
      capabilities: { streaming: true, functionCalling: true, jsonMode: false, vision: true },
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

  private requireApiKey(): void {
    if (!this.apiKey) {
      throw new ProviderError("Missing API key for Anthropic", this.id);
    }
  }

  private resolveModel(model?: string): string {
    if (!model) {
      throw new ProviderError("No model configured for Anthropic. Set defaultModel in .deepcode/config.json.", this.id);
    }
    return model;
  }

  private async assertOk(response: Response): Promise<void> {
    if (!response.ok) {
      throw new ProviderError(`Anthropic request failed: ${response.status} ${await response.text()}`, this.id);
    }
  }
}

function toAnthropicTool(tool: any): { name: string; description?: string; input_schema: unknown } {
  const definition = tool.function ?? tool;
  return {
    name: definition.name,
    description: definition.description,
    input_schema: definition.parameters ?? definition.input_schema ?? { type: "object", properties: {} },
  };
}

function parseToolInput(inputJson: string): Record<string, unknown> {
  if (!inputJson.trim()) return {};
  try {
    const parsed = JSON.parse(inputJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
