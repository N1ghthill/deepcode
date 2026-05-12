import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "@deepcode/core";
import type { DeepCodeConfig, Session } from "@deepcode/shared";
import {
  CONFIG_FIELDS,
  buildProviderHealthCheck,
  extractTaskPlanFromSession,
  formatAgentRunError,
  getRenderableChatMessages,
  getChatPreflightIssue,
  isSidebarHotkeysEnabled,
  isSlashCommandInput,
  selectInitialSessionForLaunch,
  getSlashMenuAction,
  getSlashCommandSuggestions,
  parseGithubLoginClientId,
  recordAgentRunError,
  shouldUseSelectedSlashCommand,
} from "../../src/tui/App.js";
import {
  formatModelPricing,
  isFreeModel,
} from "../../src/tui/components/modals/ModelSelector.js";

describe("App component", () => {
  it("should integrate UI state persistence", () => {
    // This is a placeholder test
    // In a real implementation, we would test the integration with ink-testing-library
    expect(true).toBe(true);
  });

  it("records agent run failures in the active session without throwing", async () => {
    const session = createSession();
    const runtime = createRuntimeStub(session, true);

    const message = await recordAgentRunError(
      runtime,
      session,
      new Error("All configured providers failed: secret-value"),
    );

    expect(message).toBe("All configured providers failed: [redacted]");
    expect(session.status).toBe("error");
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]?.role).toBe("assistant");
    expect(session.messages[0]?.source).toBe("ui");
    expect(session.messages[0]?.content).toBe(
      "Error executing task: All configured providers failed: [redacted]",
    );
    expect(runtime.sessions.persist).toHaveBeenCalledWith(session.id);
  });

  it("hides tool-result and empty operational messages from the chat transcript", () => {
    const renderable = getRenderableChatMessages([
      {
        id: "assistant-empty",
        role: "assistant",
        source: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        toolCalls: [{
          id: "toolcall_1",
          name: "list_dir",
          arguments: { path: "~" },
        }],
      },
      {
        id: "tool-output",
        role: "tool",
        source: "tool",
        content: "dir 4096 Exemplos",
        timestamp: new Date().toISOString(),
        toolCallId: "toolcall_1",
      },
      {
        id: "assistant-final",
        role: "assistant",
        source: "assistant",
        content: "dir 4096 Exemplos",
        timestamp: new Date().toISOString(),
      },
    ] as any);

    expect(renderable).toHaveLength(1);
    expect(renderable[0]?.id).toBe("assistant-final");
  });

  it("parses GitHub OAuth client IDs from TUI slash commands", () => {
    expect(parseGithubLoginClientId("/github-login --client-id abc123")).toBe("abc123");
    expect(parseGithubLoginClientId("/github-login --client-id=abc123")).toBe("abc123");
    expect(parseGithubLoginClientId("/github-login abc123")).toBe("abc123");
    expect(parseGithubLoginClientId("/github login abc123")).toBe("abc123");
    expect(parseGithubLoginClientId("/github-login")).toBeUndefined();
  });

  it("edits provider-specific model defaults instead of exposing the legacy defaultModel field", () => {
    const fieldKeys = CONFIG_FIELDS.map((field) => field.key);

    expect(fieldKeys).not.toContain("defaultModel");
    expect(fieldKeys).toContain("defaultModels.openrouter");
    expect(fieldKeys).toContain("defaultModels.anthropic");
    expect(fieldKeys).toContain("defaultModels.openai");
    expect(fieldKeys).toContain("defaultModels.deepseek");
    expect(fieldKeys).toContain("defaultModels.opencode");
  });

  it("suggests slash commands without requiring exact command names", () => {
    expect(getSlashCommandSuggestions("")).toHaveLength(0);
    expect(getSlashCommandSuggestions("/").map((item) => item.command)).toContain("/github-login");
    expect(getSlashCommandSuggestions("/git").map((item) => item.command)).toEqual(["/github-login"]);
    expect(getSlashCommandSuggestions("/providers").map((item) => item.command)).toEqual(["/provider"]);
  });

  it("only replaces partial slash commands from the menu", () => {
    const [githubLogin] = getSlashCommandSuggestions("/git");
    expect(githubLogin).toBeDefined();
    expect(shouldUseSelectedSlashCommand("/", githubLogin!)).toBe(true);
    expect(shouldUseSelectedSlashCommand("/git", githubLogin!)).toBe(true);
    expect(shouldUseSelectedSlashCommand("/github-login", githubLogin!)).toBe(false);
    expect(shouldUseSelectedSlashCommand("/github-login --client-id abc123", githubLogin!)).toBe(false);
  });

  it("distinguishes TUI slash commands from absolute filesystem paths", () => {
    expect(isSlashCommandInput("/")).toBe(true);
    expect(isSlashCommandInput("/provider")).toBe(true);
    expect(isSlashCommandInput("/providers")).toBe(true);
    expect(isSlashCommandInput("/github login")).toBe(true);
    expect(isSlashCommandInput("/github-login --client-id abc123")).toBe(true);
    expect(isSlashCommandInput("/home/irving/Documentos")).toBe(false);
    expect(isSlashCommandInput("/tmp")).toBe(false);
  });

  it("does not consume regular typing while the slash menu is open", () => {
    expect(
      getSlashMenuAction({
        showSlashMenu: true,
        slashCommandSuggestions: getSlashCommandSuggestions("/"),
        selectedSlashCommandIndex: 0,
        input: "/",
        inputChar: "g",
        key: {},
      }),
    ).toBeNull();
  });

  it("consumes slash menu navigation and execute keys only", () => {
    const suggestions = getSlashCommandSuggestions("/git");

    expect(
      getSlashMenuAction({
        showSlashMenu: true,
        slashCommandSuggestions: suggestions,
        selectedSlashCommandIndex: 0,
        input: "/git",
        inputChar: "",
        key: { downArrow: true },
      }),
    ).toEqual({ type: "move", selectedIndex: 0 });

    expect(
      getSlashMenuAction({
        showSlashMenu: true,
        slashCommandSuggestions: suggestions,
        selectedSlashCommandIndex: 0,
        input: "/git",
        inputChar: "\r",
        key: { return: true },
      }),
    ).toEqual({ type: "execute", command: "/github-login" });
  });

  it("enables sidebar tab hotkeys when the chat prompt is empty", () => {
    expect(
      isSidebarHotkeysEnabled({
        viewMode: "chat",
        vimMode: "insert",
        input: "",
        activeModal: null,
        streaming: false,
        showInputPreview: false,
        approvalCount: 0,
        oauthActive: false,
      }),
    ).toBe(true);

    expect(
      isSidebarHotkeysEnabled({
        viewMode: "chat",
        vimMode: "insert",
        input: "123",
        activeModal: null,
        streaming: false,
        showInputPreview: false,
        approvalCount: 0,
        oauthActive: false,
      }),
    ).toBe(false);

    expect(
      isSidebarHotkeysEnabled({
        viewMode: "chat",
        vimMode: "normal",
        input: "123",
        activeModal: null,
        streaming: false,
        showInputPreview: false,
        approvalCount: 0,
        oauthActive: false,
      }),
    ).toBe(true);
  });

  it("reports a generic preflight issue when no provider has credentials", () => {
    const session = createSession();
    const runtime = createRuntimeStub(session);
    runtime.config.providers.openrouter = {};

    expect(getChatPreflightIssue(runtime.config, session)).toEqual({
      message:
        "No provider with credentials is configured. Open the provider menu with Ctrl+P or use /provider to set a credential before sending messages.",
      notice: "No provider configured. Open Ctrl+P or use /provider.",
      modal: "provider",
    });
  });

  it("falls back to another configured provider instead of requiring OpenRouter in the basic flow", () => {
    const session = createSession();
    session.model = undefined;
    const runtime = createRuntimeStub(session);
    runtime.config.providers.openrouter = {};
    runtime.config.providers.deepseek = { apiKey: "deepseek-secret" };
    runtime.config.defaultModels = {
      deepseek: "deepseek-chat",
    };

    expect(getChatPreflightIssue(runtime.config, session)).toBeNull();
    expect(selectInitialSessionForLaunch([], runtime.config)).toEqual({
      type: "create",
      provider: "deepseek",
      model: "deepseek-chat",
    });
  });

  it("builds a provider health check that validates the active provider model", async () => {
    const session = createSession();
    const provider = {
      listModels: vi.fn(async () => []),
    };
    const validateProviderModel = vi.fn(async () => ({ ok: true }));
    const runtime = {
      config: {
        defaultProvider: "openrouter",
        defaultModel: "fallback-model",
        defaultModels: {},
        agentMode: "build",
        modeDefaults: {},
        providers: createProvidersConfig({
          openrouter: { apiKey: "secret" },
        }),
      },
      providers: {
        get: vi.fn(() => provider),
        validateProviderModel,
      },
    } as any;

    const check = buildProviderHealthCheck(runtime, session, "openrouter");

    await expect(check.validateProviderModel?.()).resolves.toEqual({ ok: true });
    expect(validateProviderModel).toHaveBeenCalledWith("openrouter", {
      model: "test-model",
      timeoutMs: 5000,
    });
  });

  it("skips model validation for an inactive provider and throws a useful config error", async () => {
    const session = createSession();
    const provider = {
      listModels: vi.fn(async () => {
        throw new Error("authentication failed");
      }),
    };
    const validateProviderModel = vi.fn(async () => ({ ok: true }));
    const runtime = {
      config: {
        defaultProvider: "openrouter",
        defaultModel: "test-model",
        defaultModels: {},
        agentMode: "build",
        modeDefaults: {},
        providers: createProvidersConfig({
          openrouter: { apiKey: "secret" },
        }),
      },
      providers: {
        get: vi.fn(() => provider),
        validateProviderModel,
      },
    } as any;

    const check = buildProviderHealthCheck(runtime, session, "deepseek");

    expect(check.validateProviderModel).toBeUndefined();
    await expect(check.validateConfig()).rejects.toThrow("authentication failed");
    expect(validateProviderModel).not.toHaveBeenCalled();
  });

  it("uses a provider-specific configured model when validating another provider", async () => {
    const session = createSession();
    const provider = {
      listModels: vi.fn(async () => []),
    };
    const validateProviderModel = vi.fn(async () => ({ ok: true }));
    const runtime = {
      config: {
        defaultProvider: "openrouter",
        defaultModel: "openrouter-model",
        defaultModels: {
          deepseek: "deepseek-chat",
        },
        agentMode: "build",
        modeDefaults: {},
        providers: createProvidersConfig({
          openrouter: { apiKey: "secret" },
          deepseek: { apiKey: "secret" },
        }),
      },
      providers: {
        get: vi.fn(() => provider),
        validateProviderModel,
      },
    } as any;

    const check = buildProviderHealthCheck(runtime, session, "deepseek");

    await expect(check.validateProviderModel?.()).resolves.toEqual({ ok: true });
    expect(validateProviderModel).toHaveBeenCalledWith("deepseek", {
      model: "deepseek-chat",
      timeoutMs: 5000,
    });
  });

  it("formats nested provider failures into actionable guidance", () => {
    const session = createSession();
    const runtime = createRuntimeStub(session);

    const error = new ProviderError(
      "All configured providers failed",
      "openrouter",
      new ProviderError("Missing API key for OpenRouter", "openrouter"),
    );

    expect(formatAgentRunError(runtime, session, error)).toBe(
      "OpenRouter is missing an API key. Open Ctrl+P or use /provider to configure the credential.",
    );
  });

  it("starts a fresh session instead of auto-opening one with previous logs", () => {
    const oldSession = createSession();
    oldSession.messages.push({
      id: "msg_old",
      role: "assistant",
      content: "segredo anterior",
      createdAt: new Date().toISOString(),
    });

    expect(
      selectInitialSessionForLaunch([oldSession], {
        defaultProvider: "openrouter",
        defaultModel: "test-model",
        defaultModels: {},
        modeDefaults: {},
        agentMode: "build",
        providers: createProvidersConfig(),
      }),
    ).toEqual({
      type: "create",
      provider: "openrouter",
      model: "test-model",
    });
  });

  it("may reuse a blank idle session to avoid session spam on launch", () => {
    const blankSession = createSession();

    expect(
      selectInitialSessionForLaunch([blankSession], {
        defaultProvider: "openrouter",
        defaultModel: "test-model",
        defaultModels: {},
        modeDefaults: {},
        agentMode: "build",
        providers: createProvidersConfig(),
      }),
    ).toEqual({
      type: "reuse",
      session: blankSession,
    });
  });

  it("uses the provider-specific default model when creating a new session", () => {
    expect(
      selectInitialSessionForLaunch([], {
        defaultProvider: "deepseek",
        defaultModel: "legacy-openrouter-model",
        defaultModels: {
          deepseek: "deepseek-reasoner",
        },
        modeDefaults: {},
        agentMode: "build",
        providers: createProvidersConfig({
          deepseek: { apiKey: "secret" },
        }),
      }),
    ).toEqual({
      type: "create",
      provider: "deepseek",
      model: "deepseek-reasoner",
    });
  });

  it("accepts a provider-specific model during chat preflight even without a session model", () => {
    const session = createSession();
    session.provider = "deepseek";
    session.model = undefined;
    const runtime = createRuntimeStub(session);
    runtime.config.providers.deepseek = { apiKey: "secret" };
    runtime.config.defaultModels = {
      deepseek: "deepseek-chat",
    };

    expect(getChatPreflightIssue(runtime.config, session)).toBeNull();
  });

  it("accepts provider credentials loaded through apiKeyFile during chat preflight", () => {
    const session = createSession();
    session.provider = "deepseek";
    session.model = undefined;
    const runtime = createRuntimeStub(session);
    runtime.config.providers.deepseek = { apiKeyFile: "/tmp/deepseek.key" };
    runtime.config.defaultModels = {
      deepseek: "deepseek-chat",
    };

    expect(getChatPreflightIssue(runtime.config, session)).toBeNull();
  });

  it("uses the mode-specific provider and model during chat preflight", () => {
    const session = createSession();
    const runtime = createRuntimeStub(session);
    runtime.config.providers.deepseek = { apiKey: "secret" };
    runtime.config.modeDefaults = {
      plan: {
        provider: "deepseek",
        model: "deepseek-reasoner",
      },
    };

    expect(getChatPreflightIssue(runtime.config, session, "plan")).toBeNull();
  });

  it("identifies free models only when provider pricing is explicitly zero", () => {
    const free = createModel({ inputPer1k: 0, outputPer1k: 0 });
    const paid = createModel({ inputPer1k: 0.001, outputPer1k: 0.002 });
    const unknown = createModel();

    expect(isFreeModel(free)).toBe(true);
    expect(formatModelPricing(free)).toBe("free");
    expect(isFreeModel(paid)).toBe(false);
    expect(formatModelPricing(paid)).toBe("$0.001/1k in • $0.002/1k out");
    expect(isFreeModel(unknown)).toBe(false);
    expect(formatModelPricing(unknown)).toBe("price n/a");
  });

  it("extracts a persisted task plan only when session metadata matches the runtime schema", () => {
    const session = createSession();
    session.metadata.plan = {
      objective: "Ship the fix",
      tasks: [
        {
          id: "inspect",
          description: "Inspect the code path",
          type: "research",
          dependencies: [],
          status: "completed",
        },
      ],
      currentTaskId: "inspect",
    };

    expect(extractTaskPlanFromSession(session)).toEqual(session.metadata.plan);

    session.metadata.plan = { objective: "broken" };
    expect(extractTaskPlanFromSession(session)).toBeUndefined();
  });
});

function createModel(pricing?: { inputPer1k: number; outputPer1k: number }) {
  return {
    id: "test/model",
    name: "Test Model",
    provider: "openrouter" as const,
    contextLength: 128000,
    capabilities: {
      streaming: true,
      functionCalling: true,
      jsonMode: true,
      vision: false,
    },
    pricing,
  };
}

function createSession(): Session {
  const now = new Date().toISOString();
  return {
    id: "session_test",
    worktree: "/tmp/deepcode-tui",
    provider: "openrouter",
    model: "test-model",
    status: "idle",
    messages: [],
    activities: [],
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}

function createRuntimeStub(session: Session, persistFails = false) {
  const config: DeepCodeConfig = {
    defaultProvider: "openrouter",
    defaultModel: "test-model",
    defaultModels: {},
    modeDefaults: {},
    maxIterations: 20,
    providerRetries: 0,
    temperature: 0.2,
    maxTokens: 4096,
    cache: { enabled: true, ttlSeconds: 300 },
    providers: createProvidersConfig({
      openrouter: { apiKey: "secret-value" },
    }),
    permissions: {
      read: "allow",
      write: "ask",
      gitLocal: "allow",
      shell: "ask",
      dangerous: "ask",
      allowShell: ["pnpm test"],
    },
    paths: { whitelist: ["${WORKTREE}/**"], blacklist: [] },
    lsp: { servers: [] },
    github: { oauthScopes: [] },
    tui: { theme: "dark", compactMode: false, showInputPreview: false },
    agentMode: "build",
    telemetry: { enabled: true, persistHistory: true },
  };

  const sessions = {
    addMessage: vi.fn((_sessionId: string, message: { role: "assistant"; content: string; source?: "ui" }) => {
      const full = {
        ...message,
        id: `msg_${session.messages.length + 1}`,
        createdAt: new Date().toISOString(),
      };
      session.messages.push(full);
      return full;
    }),
    persist: persistFails
      ? vi.fn(async () => {
          throw new Error("persist failed");
        })
      : vi.fn(async () => "/tmp/deepcode-tui/.deepcode/sessions/session_test.json"),
  };

  return { config, sessions } as any;
}

function createProvidersConfig(
  overrides: Partial<DeepCodeConfig["providers"]> = {},
): DeepCodeConfig["providers"] {
  return {
    openrouter: {},
    anthropic: {},
    openai: {},
    deepseek: {},
    opencode: {},
    ...overrides,
  };
}
