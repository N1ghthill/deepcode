import { describe, expect, it } from "vitest";
import type { DeepCodeConfig } from "../src/index.js";
import {
  hasAnyProviderCredentials,
  hasProviderCredentials,
  resolveUsableProviderTarget,
} from "../src/index.js";

describe("provider selection", () => {
  it("falls back from the schema default provider to a configured provider", () => {
    const config = createConfig({
      providers: {
        deepseek: { apiKey: "deepseek-secret" },
      },
      defaultModels: {
        deepseek: "deepseek-chat",
      },
    });

    expect(resolveUsableProviderTarget(config, [config.defaultProvider])).toEqual({
      provider: "deepseek",
      model: "deepseek-chat",
      hasCredentials: true,
    });
  });

  it("treats apiKeyFile as valid provider credentials", () => {
    const config = createConfig({
      providers: {
        deepseek: { apiKeyFile: "/tmp/deepseek.key" },
      },
      defaultModels: {
        deepseek: "deepseek-chat",
      },
    });

    expect(hasProviderCredentials(config.providers.deepseek)).toBe(true);
    expect(hasAnyProviderCredentials(config)).toBe(true);
    expect(resolveUsableProviderTarget(config, [config.defaultProvider])).toEqual({
      provider: "deepseek",
      model: "deepseek-chat",
      hasCredentials: true,
    });
  });
});

function createConfig(overrides: Partial<DeepCodeConfig> = {}): DeepCodeConfig {
  const {
    providers,
    defaultModels,
    ...rest
  } = overrides;

  return {
    defaultProvider: "openrouter",
    defaultModel: "openrouter/default",
    defaultModels: defaultModels ?? {},
    modeDefaults: {},
    maxIterations: 20,
    providerRetries: 2,
    temperature: 0.2,
    maxTokens: 4096,
    cache: { enabled: true, ttlSeconds: 300 },
    providers: {
      openrouter: {},
      anthropic: {},
      openai: {},
      deepseek: {},
      opencode: {},
      groq: {},
      ollama: {},
      ...providers,
    },
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
    ...rest,
  };
}
