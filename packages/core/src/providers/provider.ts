import type { ChatOptions, Chunk, Message, Model, ProviderId } from "@deepcode/shared";

export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  jsonMode: boolean;
  vision: boolean;
  maxContextLength: number;
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  chat(messages: Message[], options: ChatOptions): AsyncIterable<Chunk>;
  complete(prompt: string, options?: Omit<ChatOptions, "tools">): Promise<string>;
  listModels(): Promise<Model[]>;
  validateConfig(): Promise<boolean>;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export function toProviderMessages(messages: Message[]): Array<{ role: string; content: string }> {
  return messages
    .filter((message) => message.role !== "tool")
    .map((message) => ({
      role: message.role === "system" ? "system" : message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
}
