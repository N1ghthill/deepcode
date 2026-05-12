import { describe, expect, it } from "vitest";
import type {
  Chunk,
  DeepCodeConfig,
  Message,
  Model,
  ProviderId,
} from "@deepcode/shared";
import { ProviderManager } from "../src/providers/provider-manager.js";
import type {
  LLMProvider,
  ProviderCapabilities,
  ProviderChatOptions,
} from "../src/providers/provider.js";

describe("ProviderManager", () => {
  it("does not fail over after a provider already emitted streamed output", async () => {
    const manager = new ProviderManager(createConfig());
    manager.register(new PartialFailureProvider());
    manager.register(new FallbackProvider());

    const chunks: Chunk[] = [];
    let error: unknown;

    try {
      for await (const chunk of manager.chat([], {
        preferredProvider: "openrouter",
        failover: ["openai"],
      })) {
        chunks.push(chunk);
      }
    } catch (caught) {
      error = caught;
    }

    expect(chunks).toEqual([{ type: "delta", content: "partial" }]);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("stream disconnected");
  });

  it("accepts OpenCode model identifiers with the documented opencode-go/ prefix", async () => {
    const manager = new ProviderManager(createConfig({
      defaultProvider: "opencode",
      defaultModels: {
        opencode: "opencode-go/kimi-k2.6",
      },
      providers: {
        opencode: { apiKey: "opencode-secret" },
      },
    }));
    manager.register(new OpenCodeValidationProvider());

    const result = await manager.validateProviderModel("opencode");

    expect(result.model).toBe("kimi-k2.6");
    expect(result.modelFound).toBe(true);
    expect(result.responseText).toBe("OK");
  });
});

class PartialFailureProvider implements LLMProvider {
  readonly id = "openrouter" as const;
  readonly name = "PartialFailureProvider";
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    jsonMode: true,
    vision: false,
    maxContextLength: 128_000,
  };

  async *chat(_messages: Message[], _options: ProviderChatOptions): AsyncIterable<Chunk> {
    yield { type: "delta", content: "partial" };
    throw new Error("stream disconnected");
  }

  async complete(): Promise<string> {
    return "unused";
  }

  async listModels(): Promise<Model[]> {
    return [];
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }
}

class FallbackProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly name = "FallbackProvider";
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    jsonMode: true,
    vision: false,
    maxContextLength: 128_000,
  };

  async *chat(_messages: Message[], _options: ProviderChatOptions): AsyncIterable<Chunk> {
    yield { type: "delta", content: "fallback" };
    yield { type: "done" };
  }

  async complete(): Promise<string> {
    return "unused";
  }

  async listModels(): Promise<Model[]> {
    return [];
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }
}

class OpenCodeValidationProvider implements LLMProvider {
  readonly id = "opencode" as const;
  readonly name = "OpenCodeValidationProvider";
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    functionCalling: true,
    jsonMode: true,
    vision: false,
    maxContextLength: 128_000,
  };

  async *chat(_messages: Message[], _options: ProviderChatOptions): AsyncIterable<Chunk> {
    yield { type: "done" };
  }

  async complete(prompt: string, options?: Omit<ProviderChatOptions, "tools">): Promise<string> {
    expect(prompt).toBe("Reply exactly with: OK");
    expect(options?.model).toBe("kimi-k2.6");
    return "OK";
  }

  async listModels(): Promise<Model[]> {
    return [
      {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        provider: "opencode",
        contextLength: 128_000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          jsonMode: true,
          vision: false,
        },
      },
    ];
  }

  async validateConfig(): Promise<boolean> {
    return true;
  }
}

function createConfig(overrides: Partial<DeepCodeConfig> = {}): DeepCodeConfig {
  const { providers: overrideProviders, ...restOverrides } = overrides;

  const providers = {
    openrouter: {},
    anthropic: {},
    openai: {},
    deepseek: {},
    opencode: {},
    ...overrideProviders,
  };

  return {
    defaultProvider: "openrouter",
    defaultModel: "test-model",
    defaultModels: overrides.defaultModels ?? {},
    modeDefaults: overrides.modeDefaults ?? {},
    maxIterations: 20,
    providerRetries: 0,
    temperature: 0.2,
    maxTokens: 4096,
    cache: { enabled: true, ttlSeconds: 300 },
    providers,
    permissions: {
      read: "allow",
      write: "ask",
      gitLocal: "allow",
      shell: "ask",
      dangerous: "ask",
      allowShell: ["git status"],
    },
    paths: { whitelist: ["${WORKTREE}/**"], blacklist: [] },
    web: { allowlist: [], blacklist: [] },
    lsp: { servers: [] },
    github: { oauthScopes: [] },
    tui: { theme: "dark", compactMode: false, showInputPreview: true },
    buildTurnPolicy: {
      mode: "heuristic",
      conversationalPhrases: ["oi"],
      workspaceTerms: ["repo"],
      taskVerbs: ["mostrar"],
      fileExtensions: [".ts"],
    },
    agentMode: "build",
    strictMode: false,
    telemetry: { enabled: true, persistHistory: true },
    ...restOverrides,
  };
}
