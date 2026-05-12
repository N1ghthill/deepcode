import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import {
  resolveConfiguredModelForProvider,
  resolveUsableProviderTarget,
  type Activity,
  type Message,
  type Session,
  type AgentMode,
  type ProviderId,
} from "@deepcode/shared";
import {
  collectSecretValues,
  redactText,
  type ApprovalRequest,
  ConfigLoader,
  GitHubClient,
  GitHubOAuthDeviceFlow,
  loginWithGitHubCli,
  TelemetryCollector,
  type TaskPlan,
} from "@deepcode/core";
import { createRuntime, type DeepCodeRuntime } from "../runtime.js";
import { getTheme } from "./themes.js";
import {
  Layout,
  Header,
  Sidebar,
  StatusBar,
  type SidebarTab,
} from "./components/layout/index.js";
import {
  ProviderModal,
  ModelSelector,
  TelemetryPanel,
  InputPreview,
} from "./components/modals/index.js";
import {
  useModelCatalog,
  useTelemetry,
  useProviderStatus,
  EMPTY_PROVIDER_STATUS,
  getScopedProviderStatus,
} from "./hooks/index.js";
import { UIStateManager, type RecentModelSelection, type UIState } from "./persistence/ui-state.js";
import { ErrorBoundary } from "./components/shared/ErrorBoundary.js";
import { TypingIndicator } from "./components/shared/TypingIndicator.js";
import { useTokenEstimate } from "./hooks/useTokenEstimate.js";
import type { AppProps, ViewMode, VimMode, ModalType } from "./types.js";
import { formatModelSelection } from "./model-selection.js";
import {
  resolveEffectiveModeProvider,
  resolveEffectiveModeSelection,
} from "./mode-routing.js";
import {
  CONFIG_FIELDS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type ConfigFieldDef,
  type GithubOAuthState,
} from "./app-config.js";
import { truncate } from "./utils/truncate.js";
import {
  buildProviderHealthCheck,
  cloneTaskPlan,
  dedupeRecentModels,
  extractTaskPlanFromSession,
  formatExpectedProviderTarget,
  getChatPreflightIssue,
  getConfigValue,
  getModelPricing,
  getRenderableChatMessages,
  getSlashCommandSuggestions,
  getSlashMenuAction,
  isSidebarHotkeysEnabled,
  isSlashCommandInput,
  parseConfigEditValue,
  parseGithubLoginClientId,
  recordAgentRunError,
  resolveLaunchSessionTarget,
  selectInitialSessionForLaunch,
  serializeConfigEditValue,
  syncLegacyDefaultModel,
} from "./app-utils.js";
import {
  ApprovalPanel,
  ChatApprovalIndicator,
  ConfigEditor,
  EmptyChatState,
  GithubOAuthPanel,
  HelpView,
  PlanProgressBar,
  SessionSwitcher,
  SlashCommandMenu,
} from "./components/views/AppPanels.js";

export function App(props: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [runtime, setRuntime] = useState<DeepCodeRuntime | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [status, setStatus] = useState("loading");
  const [notice, setNotice] = useState("Ctrl+Q sai. Ctrl+H ajuda. Ctrl+O sessões. Ctrl+P providers. Ctrl+M modelos. Ctrl+T telemetria. Esc modo normal. Tab alterna modo. Ctrl+C cancela execução.");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [configEditIndex, setConfigEditIndex] = useState(0);
  const [configEditValue, setConfigEditValue] = useState("");
  const [editingConfig, setEditingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ id: string; name: string; args: string; result?: string }>>([]);
  const [vimMode, setVimMode] = useState<VimMode>("insert");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("sessions");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("build");
  const abortRef = useRef<AbortController | null>(null);
  const [telemetryCollector, setTelemetryCollector] = useState<TelemetryCollector | null>(null);
  const telemetryRef = useRef<TelemetryCollector | null>(null);
  const uiStateRef = useRef<UIStateManager | null>(null);
  const [telemetryExportStatus, setTelemetryExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [showInputPreview, setShowInputPreview] = useState(false);
  const [pendingInput, setPendingInput] = useState("");
  const [selectedSlashCommandIndex, setSelectedSlashCommandIndex] = useState(0);
  const activeSessionIdRef = useRef<string | null>(null);
  const githubOAuthAbortRef = useRef<AbortController | null>(null);
  const [githubOAuth, setGithubOAuth] = useState<GithubOAuthState>({ status: "idle" });
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | undefined>();
  const [recentModels, setRecentModels] = useState<RecentModelSelection[]>([]);
  const [liveTokens, setLiveTokens] = useState({ input: 0, output: 0, cost: 0 });
  const liveTokensRef = useRef({ input: 0, output: 0, cost: 0, startedAt: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [toolExecuting, setToolExecuting] = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const [phase, setPhase] = useState("");
  const [iteration, setIteration] = useState({ current: 0, max: 0 });

  const activateTelemetrySession = useCallback((
    targetSession: Pick<Session, "id" | "provider" | "model">,
    finalizePrevious = true,
  ) => {
    const previousSessionId = activeSessionIdRef.current;
    activeSessionIdRef.current = targetSession.id;

    const collector = telemetryRef.current;
    if (!collector) {
      return;
    }

    if (finalizePrevious && previousSessionId && previousSessionId !== targetSession.id) {
      void collector.finalizeSession(previousSessionId);
    }

    void collector.createSession(targetSession.id, targetSession.provider, targetSession.model || "unknown");
  }, []);

  useEffect(() => {
    if (!stdout.isTTY) return;
    stdout.write("\x1b[?1049h\x1b[?25l");
    return () => {
      stdout.write("\x1b[?25h\x1b[?1049l");
    };
  }, [stdout]);

  useEffect(() => {
    let mounted = true;
    let cleanupRuntime: (() => void) | undefined;
    createRuntime({ cwd: props.cwd, configPath: props.config, interactive: true })
      .then(async (created) => {
        if (!mounted) return;

        // Initialize UI state manager
        const uiStateManager = new UIStateManager(props.cwd);
        uiStateRef.current = uiStateManager;

        // Try to restore UI state
        const savedState = await uiStateManager.load();
        if (savedState) {
          setViewMode(savedState.viewMode);
          setSidebarTab(savedState.sidebarTab);
          setAgentMode(savedState.agentMode);
          setVimMode(savedState.vimMode);
          setSelectedSessionIndex(savedState.selectedSessionIndex);
          setHistory(savedState.inputHistory);
          setRecentModels(savedState.modals.recentModels ?? []);
        }

        // Initialize telemetry
        const collector = new TelemetryCollector({ worktree: props.cwd });
        await collector.init();
        setTelemetryCollector(collector);
        telemetryRef.current = collector;

        const initialSession = selectInitialSessionForLaunch(
          created.sessions.list(),
          created.config,
        );
        const active =
          initialSession.type === "reuse"
            ? initialSession.session
            : created.sessions.create({
                provider: initialSession.provider,
                model: initialSession.model,
              });
        activateTelemetrySession(active, false);

        const offActivity = created.events.on("activity", (activity) => {
          setActivities((current) => [...current.slice(-10), activity]);
          const meta = activity.metadata;
          if (meta && meta.tool) {
            setToolExecuting(true);
            setToolCalls((current) => [
              ...current.slice(-8),
              {
                id: activity.id,
                name: String(meta.tool),
                args: meta.args ? JSON.stringify(meta.args) : "",
              },
            ]);
            telemetryRef.current?.recordToolCall(activeSessionIdRef.current ?? active.id, String(meta.tool));
          }
        });
        const offApproval = created.events.on("approval:request", (request) => {
          setApprovals((current) => [...current, request]);
          setStatus("awaiting approval");
          setNotice(
            `Aprovação pendente: ${redactText(request.operation, collectSecretValues(created.config))}`,
          );
        });
        const offError = created.events.on("app:error", ({ error }) => {
          setNotice(redactText(error.message, collectSecretValues(created.config)));
          telemetryRef.current?.recordError(
            activeSessionIdRef.current ?? active.id,
            "agent_error",
            error.message,
          );
        });
        cleanupRuntime = () => {
          offActivity();
          offApproval();
          offError();
          // Reject all pending approvals when session ends
          created.permissions.rejectAllPending("Session ended");
          runtime.permissions.clearSessionAllowSet();
          if (activeSessionIdRef.current) {
            void collector.finalizeSession(activeSessionIdRef.current);
          }
        };

        setAgentMode(created.config.agentMode);
        setRuntime(created);
        setSession(active);
        setMessages(active.messages);
        setActivities(active.activities.slice(-10));
        setStatus(active.status);
        setCurrentPlan(extractTaskPlanFromSession(active));
      })
      .catch((err: unknown) =>
        setError(redactText(err instanceof Error ? err.message : String(err))),
      );
    return () => {
      mounted = false;
      cleanupRuntime?.();
    };
  }, [activateTelemetrySession, props.cwd, props.config]);

  const theme = useMemo(() => (runtime ? getTheme(runtime.config.tui.theme) : getTheme("dark")), [runtime?.config.tui.theme]);
  const { statuses, checkStatus } = useProviderStatus();

  const provider = runtime ? runtime.providers : null;
  const activeModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, agentMode)
    : null;
  const planModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, "plan")
    : null;
  const buildModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, "build")
    : null;
  const currentProviderId = runtime && session
    ? resolveEffectiveModeProvider(runtime.config, session, agentMode)
    : runtime
      ? resolveUsableProviderTarget(runtime.config, [runtime.config.defaultProvider]).provider
      : "openrouter";
  const activeProviderId: ProviderId = activeModeSelection?.provider ?? currentProviderId;
  const activeTarget = activeModeSelection
    ? formatModelSelection(activeModeSelection)
    : undefined;
  const activeProviderStatus = getScopedProviderStatus(
    statuses[activeProviderId],
    activeTarget,
  );
  const providerEntries = useMemo(() => {
    if (!provider || !runtime) {
      return [];
    }

    return PROVIDER_IDS.map((providerId) => ({
      id: providerId,
      provider: {
        listModels: async (options?: { signal?: AbortSignal }) => provider.get(providerId).listModels(options),
      },
      enabled: Boolean(
        runtime.config.providers[providerId]?.apiKey ||
        runtime.config.providers[providerId]?.apiKeyFile,
      ),
    }));
  }, [provider, runtime]);
  const { models, loading: modelsLoading, error: modelsError, refresh: refreshModels } = useModelCatalog(
    providerEntries,
  );

  const telemetry = useTelemetry(session?.id ?? "", telemetryCollector);

  const sessionList = runtime ? runtime.sessions.list() : [];
  const visibleMessages = useMemo(
    () => getRenderableChatMessages(messages),
    [messages],
  );

  const estimatedTokens = useTokenEstimate(pendingInput);
  const slashCommandSuggestions = useMemo(
    () => getSlashCommandSuggestions(input),
    [input],
  );
  const showSlashMenu =
    viewMode === "chat" &&
    vimMode === "insert" &&
    !activeModal &&
    !streaming &&
    !showInputPreview &&
    slashCommandSuggestions.length > 0 &&
    isSlashCommandInput(input);
  const sidebarHotkeysEnabled = isSidebarHotkeysEnabled({
    viewMode,
    vimMode,
    input,
    activeModal,
    streaming,
    showInputPreview,
    approvalCount: approvals.length,
    oauthActive: githubOAuth.status !== "idle",
  });

  useEffect(() => {
    setSelectedSlashCommandIndex(0);
  }, [input]);

  useEffect(() => {
    if (!currentPlan && sidebarTab === "plan") {
      setSidebarTab("activities");
    }
  }, [currentPlan, sidebarTab]);

  // Live metrics: flush accumulator + compute elapsed every 250ms during execution
  useEffect(() => {
    if (!streaming) {
      if (liveIntervalRef.current) {
        globalThis.clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }

    liveIntervalRef.current = globalThis.setInterval(() => {
      const acc = liveTokensRef.current;
      if (acc.startedAt > 0) {
        setElapsed(Date.now() - acc.startedAt);
      }
      setLiveTokens({
        input: acc.input,
        output: acc.output,
        cost: acc.cost,
      });
    }, 250);

    return () => {
      if (liveIntervalRef.current) {
        globalThis.clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [streaming]);

  function applyUpdatedConfig(activeRuntime: DeepCodeRuntime, updatedConfig: DeepCodeRuntime["config"]): void {
    Object.assign(activeRuntime.config, updatedConfig);
    activeRuntime.providers.reload(activeRuntime.config);
    setRuntime((prev) => (prev ? { ...prev, config: activeRuntime.config } : prev));
  }

  // Helper function to save UI state
  const saveUIState = useCallback(() => {
    if (!uiStateRef.current || !session) return;
    const stateToSave: UIState = {
      lastActiveSessionId: session.id,
      lastSessionTimestamp: Date.now(),
      viewMode,
      sidebarTab,
      agentMode,
      vimMode,
      selectedSessionIndex,
      inputHistory: history,
      modals: { providerExpanded: false, modelFilter: "", recentModels },
      version: 1,
      savedAt: new Date().toISOString(),
    };
    void uiStateRef.current.save(stateToSave);
  }, [session, viewMode, sidebarTab, agentMode, vimMode, selectedSessionIndex, history, recentModels]);

  useInput((inputChar, key) => {
    // ===== NÍVEL 0: Comandos de emergência (sempre funcionam) =====
    if (key.ctrl && inputChar === "q") {
      saveUIState();
      abortRef.current?.abort();
      githubOAuthAbortRef.current?.abort();
      exit();
      return;
    }

    if (key.ctrl && inputChar === "c") {
      if (githubOAuthAbortRef.current) {
        githubOAuthAbortRef.current.abort();
        githubOAuthAbortRef.current = null;
        setGithubOAuth((current) => ({
          ...current,
          status: "cancelled",
          message: "GitHub OAuth cancelado.",
        }));
        setNotice("GitHub OAuth cancelado.");
      } else if (streaming) {
        abortRef.current?.abort();
        setStreaming(false);
        setStatus("cancelled");
        setNotice("Execução cancelada.");
      } else {
        exit();
      }
      return;
    }

    if (!runtime || !session) return;

    // ===== NÍVEL 1: GitHub OAuth em andamento (bloqueia quase tudo) =====
    if (githubOAuthAbortRef.current || githubOAuth.status === "waiting") {
      if (key.escape) {
        githubOAuthAbortRef.current?.abort();
        githubOAuthAbortRef.current = null;
        setGithubOAuth({ status: "idle" });
        setNotice("GitHub OAuth cancelado.");
        return;
      }
      // Retry
      if (inputChar?.toLowerCase() === "r") {
        void startGithubLogin("/github-login", runtime);
        return;
      }
      // Durante OAuth, bloquear todos os outros comandos
      return;
    }

    // ===== NÍVEL 2: Modal aberto (bloqueia atalhos globais) =====
    if (activeModal) {
      if (key.escape) {
        setActiveModal(null);
        setNotice("Modal fechado.");
        return;
      }
      // NÃO permitir abrir outros modais ou mudar view mode
      // Cada modal processa suas próprias teclas internamente
      return;
    }

    // ===== NÍVEL 3: Aprovação pendente (bloqueia interface) =====
    if (approvals.length > 0) {
      if (inputChar?.toLowerCase() === "a") {
        resolveApproval(runtime, approvals[0], true, "once");
        return;
      }
      if (inputChar?.toLowerCase() === "l") {
        resolveApproval(runtime, approvals[0], true, "always");
        return;
      }
      if (inputChar?.toLowerCase() === "s") {
        resolveApproval(runtime, approvals[0], true, "session");
        return;
      }
      if (inputChar?.toLowerCase() === "d" || inputChar?.toLowerCase() === "n") {
        resolveApproval(runtime, approvals[0], false);
        return;
      }
      if (key.escape) {
        resolveApproval(runtime, approvals[0], false);
        return;
      }
      // Bloquear outros comandos enquanto aguarda aprovação
      return;
    }

    // ===== NÍVEL 4: Input Preview =====
    if (showInputPreview) {
      if (key.escape || key.return) {
        setShowInputPreview(false);
        return;
      }
      return;
    }

    // ===== NÍVEL 5: View Modes específicos =====
    if (viewMode === "sessions") {
      const sessionList = runtime.sessions.list();
      if (key.upArrow) {
        setSelectedSessionIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedSessionIndex((current) =>
          Math.min(Math.max(0, sessionList.length - 1), current + 1),
        );
        return;
      }
      if (key.return) {
        const selected = sessionList[selectedSessionIndex];
        if (selected) {
          switchSession(selected);
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
        return;
      }
      return;
    }

    if (viewMode === "config") {
      if (editingConfig) {
        const field = CONFIG_FIELDS[configEditIndex];
        if (key.escape) {
          setEditingConfig(false);
          setConfigEditValue("");
          return;
        }
        if (key.return) {
          if (field) {
            void saveConfigEdit(runtime, field, configEditValue);
          }
          return;
        }
        if (field?.type === "toggle") {
          if (inputChar?.toLowerCase() === "y" || inputChar?.toLowerCase() === "t" || inputChar?.toLowerCase() === "1") {
            setConfigEditValue("true");
          } else if (inputChar?.toLowerCase() === "n" || inputChar?.toLowerCase() === "f" || inputChar?.toLowerCase() === "0") {
            setConfigEditValue("false");
          }
          return;
        }
        if (key.backspace || key.delete) {
          setConfigEditValue((current) => current.slice(0, -1));
          return;
        }
        if (inputChar && !key.ctrl && !key.meta) {
          setConfigEditValue((current) => current + inputChar);
          return;
        }
        return;
      }

      if (key.upArrow || inputChar?.toLowerCase() === "k") {
        setConfigEditIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow || inputChar?.toLowerCase() === "j") {
        setConfigEditIndex((current) =>
          Math.min(CONFIG_FIELDS.length - 1, current + 1),
        );
        return;
      }
      if (key.return || inputChar?.toLowerCase() === "i" || inputChar?.toLowerCase() === "e") {
        const field = CONFIG_FIELDS[configEditIndex];
        if (field) {
          const currentValue = getConfigValue(runtime.config, field.key);
          setConfigEditValue(serializeConfigEditValue(currentValue));
          setEditingConfig(true);
          if (inputChar?.toLowerCase() === "i") setVimMode("insert");
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
        return;
      }
      return;
    }

    if (viewMode === "help") {
      if (key.escape || key.return || inputChar?.toLowerCase() === "q") {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
      }
      return;
    }

    // ===== NÍVEL 6: Chat Normal (atalhos globais) =====
    // Só chega aqui se estiver em viewMode === "chat" e sem modais/aprovações

    if (key.ctrl && inputChar === "h") {
      setViewMode("help");
      setVimMode("normal");
      setNotice("Ajuda aberta. Pressione Q ou Escape para voltar.");
      return;
    }

    if (key.ctrl && inputChar === "o") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice("Selecione uma sessão com ↑/↓ e Enter. Escape para voltar.");
      return;
    }

    if (key.ctrl && inputChar === "n") {
      createNewSession(runtime);
      return;
    }

    if (key.ctrl && inputChar === "p") {
      setActiveModal("provider");
      setNotice("Modal de providers aberto. Escape para fechar.");
      return;
    }

    if (key.ctrl && inputChar === "m") {
      setActiveModal("model");
      setNotice(`Seletor de modelos do modo ${agentMode.toUpperCase()} aberto. Escape para fechar, Enter para selecionar.`);
      return;
    }

    if (key.ctrl && inputChar === "t") {
      setActiveModal("telemetry");
      setNotice("Painel de telemetria aberto. Escape para fechar.");
      return;
    }

    if (key.tab && !key.ctrl && !showSlashMenu) {
      setAgentMode((current) => {
        const next = current === "build" ? "plan" : "build";
        const nextSelection = runtime && session ? resolveEffectiveModeSelection(runtime.config, session, next) : null;
        setNotice(
          nextSelection
            ? `Modo alterado para ${next.toUpperCase()} com ${formatModelSelection(nextSelection)}.`
            : `Modo alterado para ${next.toUpperCase()}.`,
        );
        return next;
      });
      return;
    }

    // ===== NÍVEL 7: Chat input normal =====
    if (streaming) return;

    if (viewMode === "chat" && vimMode === "normal") {
      if (inputChar?.toLowerCase() === "i") {
        setVimMode("insert");
        return;
      }
      if (inputChar?.toLowerCase() === "a") {
        setVimMode("insert");
        return;
      }
      if (key.escape) {
        setVimMode("normal");
        return;
      }
      return;
    }

    if (viewMode === "chat" && vimMode === "insert" && key.escape && !showSlashMenu) {
      setVimMode("normal");
      setNotice(
        input.trim().length === 0
          ? "Modo NORMAL ativo. Use 1-4 para abas laterais ou i para inserir."
          : "Modo NORMAL ativo. Pressione i para continuar editando a mensagem.",
      );
      return;
    }

    const slashMenuAction = getSlashMenuAction({
      showSlashMenu,
      slashCommandSuggestions,
      selectedSlashCommandIndex,
      input,
      inputChar,
      key,
    });
    if (slashMenuAction) {
      if (slashMenuAction.type === "move") {
        setSelectedSlashCommandIndex(slashMenuAction.selectedIndex);
      } else if (slashMenuAction.type === "close") {
        setInput("");
        setNotice("Comando cancelado.");
      } else {
        setInput("");
        handleCommand(slashMenuAction.command, runtime);
      }
      return;
    }

    if (key.return || inputChar === "\r" || inputChar === "\n") {
      const trimmedInput = input.trim();
      if (isSlashCommandInput(trimmedInput)) {
        void submitInput(trimmedInput, runtime, session);
        return;
      }
      if (runtime?.config.tui.showInputPreview && !showInputPreview) {
        setPendingInput(input);
        setShowInputPreview(true);
        return;
      }
      void submitInput(input.trim(), runtime, session);
      return;
    }

    if (key.upArrow) {
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      return;
    }

    if (key.downArrow) {
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? "");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((current) => current.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput((current) => current + inputChar);
    }
  });

  async function saveConfigEdit(
    activeRuntime: DeepCodeRuntime,
    field: ConfigFieldDef,
    value: string,
  ): Promise<void> {
    try {
      const { ConfigLoader } = await import("@deepcode/core");
      const loader = new ConfigLoader();
      const fileConfig = await loader.loadFile({ cwd: props.cwd, configPath: props.config });
      const currentValue = getConfigValue(fileConfig, field.key);

      let parsed = parseConfigEditValue(value, currentValue, field.type);
      if (field.type === "number") {
        if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
          setConfigSaveStatus("Valor inválido");
          setEditingConfig(false);
          return;
        }
      }

      const keys = field.key.split(".");
      const mutable = JSON.parse(JSON.stringify(fileConfig)) as Record<string, unknown>;
      let obj: Record<string, unknown> = mutable;
      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (key) {
          if (!(key in obj) || typeof obj[key] !== "object" || obj[key] === null) {
            obj[key] = {};
          }
          obj = obj[key] as Record<string, unknown>;
        }
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        if (
          field.key.startsWith("defaultModels.")
          && typeof parsed === "string"
          && parsed.trim().length === 0
        ) {
          delete obj[lastKey];
        } else {
          obj[lastKey] = parsed;
        }
      }

      if (field.key === "defaultProvider" || field.key.startsWith("defaultModels.")) {
        syncLegacyDefaultModel(mutable);
      }

      await loader.save({ cwd: props.cwd, configPath: props.config }, mutable as any);

      const updatedConfig = await loader.load({ cwd: props.cwd, configPath: props.config });
      applyUpdatedConfig(activeRuntime, updatedConfig);

      setConfigSaveStatus(`${field.label} atualizado`);
      setEditingConfig(false);
      setConfigEditValue("");
      setTimeout(() => setConfigSaveStatus(null), 3000);
    } catch (err) {
      setConfigSaveStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      setEditingConfig(false);
    }
  }

  async function saveConfigPatch(
    activeRuntime: DeepCodeRuntime,
    mutate: (mutable: Record<string, unknown>) => void,
  ): Promise<DeepCodeRuntime["config"]> {
    const loader = new ConfigLoader();
    const loadOptions = { cwd: props.cwd, configPath: props.config };
    const fileConfig = await loader.loadFile(loadOptions);
    const mutable = JSON.parse(JSON.stringify(fileConfig)) as Record<string, unknown>;
    mutate(mutable);
    await loader.save(loadOptions, mutable as any);
    const updatedConfig = await loader.load(loadOptions);
    applyUpdatedConfig(activeRuntime, updatedConfig);
    return updatedConfig;
  }

  async function submitInput(
    prompt: string,
    activeRuntime: DeepCodeRuntime,
    activeSession: Session,
  ): Promise<void> {
    if (!prompt) return;

    if (isSlashCommandInput(prompt)) {
      handleCommand(prompt, activeRuntime);
      setInput("");
      return;
    }

    const preflightIssue = getChatPreflightIssue(activeRuntime.config, activeSession, agentMode);
    if (preflightIssue) {
      setNotice(preflightIssue.notice);
      if (preflightIssue.modal) {
        setActiveModal(preflightIssue.modal);
      }
      activeRuntime.sessions.addMessage(activeSession.id, {
        role: "assistant",
        source: "ui",
        content: preflightIssue.message,
      });
      setMessages([...activeSession.messages]);
      return;
    }

    setInput("");
    setHistory((current) => [...current, prompt].slice(-50));
    setHistoryIndex(null);
    setStreaming(true);
    setAssistantDraft("");
    setStatus("executing");
    setNotice("Executando tarefa...");
    setToolCalls([]);
    setCurrentPlan(undefined);
    setElapsed(0);
    setToolExecuting(false);
    setPhase("planning");
    setIteration({ current: 0, max: 0 });
    liveTokensRef.current = { input: 0, output: 0, cost: 0, startedAt: Date.now() };
    setLiveTokens({ input: 0, output: 0, cost: 0 });

    const controller = new AbortController();
    abortRef.current = controller;
    void telemetryRef.current?.createSession(
      activeSession.id,
      activeSession.provider,
      activeSession.model || "unknown",
    );

    const modelPricing = getModelPricing(models, activeSession.provider, activeSession.model || "");
    const promise = activeRuntime.agent.run({
      session: activeSession,
      input: prompt,
      mode: agentMode,
      signal: controller.signal,
      onChunk: (text) => {
        setToolExecuting(false);
        setAssistantDraft(
          (current) => current + redactText(text, collectSecretValues(activeRuntime.config)),
        );
        setMessages([...activeSession.messages]);
      },
      onUsage: (inputTokens, outputTokens) => {
        const cost = (inputTokens / 1000) * modelPricing.inputPer1k + (outputTokens / 1000) * modelPricing.outputPer1k;
        liveTokensRef.current.input += inputTokens;
        liveTokensRef.current.output += outputTokens;
        liveTokensRef.current.cost += cost;
        telemetryRef.current?.recordTokenUsage(
          activeSession.id,
          inputTokens,
          outputTokens,
          modelPricing.inputPer1k,
          modelPricing.outputPer1k,
        );
      },
      onIteration: (current, max) => {
        setIteration({ current, max });
        setPhase("executing");
      },
      onTaskUpdate: (_task, plan) => {
        const nextPlan = cloneTaskPlan(plan);
        activeSession.metadata.plan = nextPlan;
        setCurrentPlan(nextPlan);
        const progress = plan.tasks.filter((t) => t.status === "completed").length;
        setPhase(`task ${progress + 1}/${plan.tasks.length}`);
        setIteration({ current: progress + 1, max: plan.tasks.length });
      },
    });
    setMessages([...activeSession.messages]);

    try {
      await promise;
      setMessages([...activeSession.messages]);
      setActivities(activeSession.activities.slice(-10));
      setStatus(activeSession.status);
      setCurrentPlan(extractTaskPlanFromSession(activeSession));
      const planError = activeSession.metadata?.planError as string | undefined;
      if (planError && !currentPlan) {
        setNotice(`⚠ Planejamento falhou: ${planError}. Continuando sem plano estruturado.`);
      } else {
        setNotice("Tarefa concluída.");
      }
    } catch (err) {
      const message = await recordAgentRunError(activeRuntime, activeSession, err);
      setMessages([...activeSession.messages]);
      setActivities(activeSession.activities.slice(-10));
      setStatus("error");
      setCurrentPlan(extractTaskPlanFromSession(activeSession));
      setNotice(`Erro: ${message}`);
    } finally {
      setStreaming(false);
      setAssistantDraft("");
      setToolExecuting(false);
      setPhase("");
      setIteration({ current: 0, max: 0 });
      abortRef.current = null;
    }
  }

  function handleCommand(command: string, activeRuntime: DeepCodeRuntime): void {
    const [name] = command.split(/\s+/, 1);
    if (name === "/help") {
      setViewMode("help");
      setVimMode("normal");
      setNotice("Ajuda aberta.");
      return;
    }
    if (name === "/clear") {
      setMessages([]);
      setAssistantDraft("");
      setNotice("Tela limpa. A sessão continua salva.");
      return;
    }
    if (name === "/new") {
      createNewSession(activeRuntime);
      return;
    }
    if (name === "/sessions") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice("Selecione uma sessão com ↑/↓ e Enter.");
      return;
    }
    if (name === "/config") {
      setConfigEditIndex(0);
      setEditingConfig(false);
      setConfigEditValue("");
      setConfigSaveStatus(null);
      setViewMode("config");
      setVimMode("normal");
      setNotice("Configuração: ↑/↓ ou j/k navega, Enter/i edita, Esc volta.");
      return;
    }
    if (name === "/provider" || name === "/providers") {
      setActiveModal("provider");
      setNotice("Modal de providers aberto.");
      return;
    }
    if (name === "/model" || name === "/models") {
      setActiveModal("model");
      setNotice(`Seletor de modelos do modo ${agentMode.toUpperCase()} aberto.`);
      return;
    }
    if (name === "/mode") {
      const [, value] = command.trim().split(/\s+/, 2);
      if (value === "plan" || value === "build") {
        setAgentMode(value);
        const nextSelection = session
          ? resolveEffectiveModeSelection(activeRuntime.config, session, value)
          : null;
        setNotice(
          nextSelection
            ? `Modo alterado para ${value.toUpperCase()} com ${formatModelSelection(nextSelection)}.`
            : `Modo alterado para ${value.toUpperCase()}.`,
        );
        return;
      }
      setNotice("Uso: /mode plan ou /mode build");
      return;
    }
    if (name === "/github-login" || command.startsWith("/github login")) {
      void startGithubLogin(command, activeRuntime);
      return;
    }
    setNotice(`Comando desconhecido: ${command}`);
  }

  function createNewSession(activeRuntime: DeepCodeRuntime): void {
    const next = activeRuntime.sessions.create(resolveLaunchSessionTarget(activeRuntime.config, agentMode));
    activateTelemetrySession(next);
    setSession(next);
    setMessages([]);
    setActivities([]);
    setApprovals([]);
    setToolCalls([]);
    setStatus(next.status);
    setCurrentPlan(extractTaskPlanFromSession(next));
    setViewMode("chat");
    setVimMode("insert");
    activeRuntime.permissions.clearSessionAllowSet();
    setNotice(`Nova sessão: ${next.id}`);
  }

  function switchSession(next: Session): void {
    // Clear any pending approvals from the previous session
    setApprovals([]);
    activateTelemetrySession(next);
    setSession(next);
    setMessages(next.messages);
    setActivities(next.activities.slice(-10));
    setApprovals([]);
    setToolCalls([]);
    setStatus(next.status);
    setCurrentPlan(extractTaskPlanFromSession(next));
    setAssistantDraft("");
    setViewMode("chat");
    setVimMode("insert");
    runtime?.permissions.clearSessionAllowSet();
    setNotice(`Sessão ativa: ${next.id}`);
  }

  async function startGithubLogin(command: string, activeRuntime: DeepCodeRuntime): Promise<void> {
    if (!session) return;
    if (githubOAuthAbortRef.current) {
      setNotice("GitHub OAuth já está em andamento. Use Ctrl+C para cancelar.");
      return;
    }
    const controller = new AbortController();
    githubOAuthAbortRef.current = controller;
    setGithubOAuth({ status: "opening", message: "Preparando GitHub OAuth..." });
    try {
      const explicitClientId = parseGithubLoginClientId(command);
      const loader = new ConfigLoader();
      const loadOptions = { cwd: props.cwd, configPath: props.config };
      const fileConfig = await loader.loadFile(loadOptions);
      const effectiveConfig = await loader.load(loadOptions);
      const clientId = explicitClientId ?? effectiveConfig.github.oauthClientId;
      if (!clientId) {
        await startGithubCliLogin({
          activeRuntime,
          fileConfig,
          effectiveConfig,
          loader,
          loadOptions,
        });
        return;
      }
      const token = await authorizeWithGitHubOAuthApp({
        activeRuntime,
        command,
        clientId,
        controller,
        effectiveConfig,
        explicitClientId,
      });
      setGithubOAuth((current) => ({
        ...current,
        status: "saving",
        message: "Autorização recebida. Salvando token...",
      }));
      await validateGithubToken(effectiveConfig, token.accessToken);
      await saveGithubToken({
        activeRuntime,
        fileConfig,
        loader,
        loadOptions,
        token: token.accessToken,
        oauthClientId: explicitClientId ?? fileConfig.github?.oauthClientId,
        oauthScopes: effectiveConfig.github.oauthScopes,
      });
      setGithubOAuth((current) => ({
        ...current,
        status: "success",
        message: "GitHub OAuth concluído e token salvo.",
      }));
      setNotice("GitHub OAuth concluído e token salvo.");
    } catch (err) {
      const message = redactText(
        err instanceof Error ? err.message : String(err),
        collectSecretValues(activeRuntime.config),
      );
      const cancelled = controller.signal.aborted || /cancelled|aborted/i.test(message);
      setGithubOAuth((current) => ({
        ...current,
        status: cancelled ? "cancelled" : "error",
        message: cancelled ? "GitHub OAuth cancelado." : message,
      }));
      setNotice(cancelled ? "GitHub OAuth cancelado." : `GitHub OAuth falhou: ${message}`);
    } finally {
      if (githubOAuthAbortRef.current === controller) {
        githubOAuthAbortRef.current = null;
      }
    }
  }

  async function authorizeWithGitHubOAuthApp({
    activeRuntime,
    command,
    clientId,
    controller,
    effectiveConfig,
    explicitClientId,
  }: {
    activeRuntime: DeepCodeRuntime;
    command: string;
    clientId: string;
    controller: AbortController;
    effectiveConfig: DeepCodeRuntime["config"];
    explicitClientId?: string;
  }) {
    const flow = new GitHubOAuthDeviceFlow({
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      openBrowser: true,
      signal: controller.signal,
      onBrowserOpenError: (error) => {
        setGithubOAuth((current) => ({
          ...current,
          browserError: error.message,
        }));
        setNotice("Não consegui abrir o navegador automaticamente. Use a URL/código exibidos.");
      },
    });
    setNotice("Abrindo autenticação GitHub no navegador...");
    return flow.authorize({
      clientId,
      scopes: effectiveConfig.github.oauthScopes,
      onVerification: (code) => {
        const expiresAt = new Date(Date.now() + code.expiresIn * 1000).toLocaleTimeString();
        setGithubOAuth({
          status: "waiting",
          verificationUri: code.verificationUri,
          userCode: code.userCode,
          expiresAt,
          message: "Aguardando autorização no GitHub.",
        });
        if (!session) return;
        activeRuntime.sessions.addMessage(session.id, {
          role: "assistant",
          source: "ui",
          content: [
            "GitHub OAuth iniciado.",
            `URL: ${code.verificationUri}`,
            `Código: ${code.userCode}`,
            `Expira às ${expiresAt}.`,
            explicitClientId ? "OAuth app informado no comando." : "OAuth app carregado da configuração.",
            command.startsWith("/github login") ? "Comando: /github login" : "Comando: /github-login",
          ].join("\n"),
        });
        setMessages([...session.messages]);
        setNotice(`GitHub OAuth: copie o código ${code.userCode} se o navegador não preencher automaticamente.`);
      },
      onPoll: ({ attempt }) => {
        if (attempt === 1) setNotice("Aguardando autorização GitHub...");
      },
    });
  }

  async function startGithubCliLogin({
    activeRuntime,
    fileConfig,
    effectiveConfig,
    loader,
    loadOptions,
  }: {
    activeRuntime: DeepCodeRuntime;
    fileConfig: Awaited<ReturnType<ConfigLoader["loadFile"]>>;
    effectiveConfig: DeepCodeRuntime["config"];
    loader: ConfigLoader;
    loadOptions: { cwd: string; configPath?: string };
  }): Promise<void> {
    setGithubOAuth({
      status: "opening",
      message: "Abrindo login do GitHub no navegador via GitHub CLI...",
    });
    setNotice("Abrindo login GitHub pelo navegador...");

    const outputBuffer: string[] = [];
    const token = await loginWithGitHubCli({
      cwd: props.cwd,
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      scopes: effectiveConfig.github.oauthScopes,
      signal: githubOAuthAbortRef.current?.signal,
      onOutput: (chunk) => {
        outputBuffer.push(chunk);
        const output = redactText(
          outputBuffer.join("").replace(/\s+/g, " ").trim(),
          collectSecretValues(activeRuntime.config),
        );
        setGithubOAuth({
          status: "waiting",
          message: output ? truncate(output, 220) : "Aguardando autorização no navegador.",
        });
      },
    });

    await validateGithubToken(effectiveConfig, token);
    await saveGithubToken({
      activeRuntime,
      fileConfig,
      loader,
      loadOptions,
      token,
      oauthClientId: fileConfig.github?.oauthClientId,
      oauthScopes: effectiveConfig.github.oauthScopes,
    });
    setGithubOAuth({
      status: "success",
      message: "GitHub login concluído via navegador e token salvo no DeepCode.",
    });
    setNotice("GitHub login concluído e token salvo.");
  }

  async function validateGithubToken(
    effectiveConfig: DeepCodeRuntime["config"],
    token: string,
  ): Promise<void> {
    const client = new GitHubClient({
      token,
      enterpriseUrl: effectiveConfig.github.enterpriseUrl,
      worktree: props.cwd,
    });
    await client.getAuthenticatedUser();
  }

  async function saveGithubToken({
    activeRuntime,
    fileConfig,
    loader,
    loadOptions,
    token,
    oauthClientId,
    oauthScopes,
  }: {
    activeRuntime: DeepCodeRuntime;
    fileConfig: Awaited<ReturnType<ConfigLoader["loadFile"]>>;
    loader: ConfigLoader;
    loadOptions: { cwd: string; configPath?: string };
    token: string;
    oauthClientId?: string;
    oauthScopes: string[];
  }): Promise<void> {
    await loader.save(loadOptions, {
      ...fileConfig,
      github: {
        ...fileConfig.github,
        token,
        oauthClientId,
        oauthScopes,
      },
    });
    const updatedConfig = await loader.load(loadOptions);
    applyUpdatedConfig(activeRuntime, updatedConfig);
  }

  function resolveApproval(
    activeRuntime: DeepCodeRuntime,
    request: ApprovalRequest | undefined,
    allowed: boolean,
    scope: "once" | "session" | "always" = "once",
  ): void {
    if (!request) return;
    activeRuntime.events.emit("approval:decision", {
      requestId: request.id,
      decision: {
        allowed,
        scope: allowed ? scope : undefined,
        reason: allowed
          ? scope === "session"
            ? "Approved for session from TUI"
            : scope === "always"
              ? "Approved permanently from TUI"
              : "Approved from TUI"
          : "Denied from TUI",
      },
    });
    setApprovals((current) => current.filter((item) => item.id !== request.id));
    setStatus(allowed ? "executing" : "denied");
    const label = allowed
      ? scope === "session" ? "Aprovado (sessão)" : scope === "always" ? "Aprovado (sempre)" : "Aprovado"
      : "Negado";
    setNotice(
      `${label}: ${redactText(request.operation, collectSecretValues(activeRuntime.config))}`,
    );
  }

  async function handleExportTelemetry(): Promise<void> {
    if (!telemetryCollector || !session) return;

    setTelemetryExportStatus('exporting');
    try {
      const exportPath = await telemetryCollector.exportToJson(session.id);
      setLastExportPath(exportPath);
      setTelemetryExportStatus('success');
      setNotice(`Telemetria exportada para: ${exportPath}`);
      setTimeout(() => setTelemetryExportStatus('idle'), 5000);
    } catch (err) {
      setTelemetryExportStatus('error');
      setNotice(`Erro ao exportar: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setTelemetryExportStatus('idle'), 5000);
    }
  }

  function handleConfirmInput(): void {
    if (!runtime || !session) return;
    setShowInputPreview(false);
    void submitInput(pendingInput.trim(), runtime, session);
    setPendingInput("");
  }

  function handleCancelInput(): void {
    setShowInputPreview(false);
    setPendingInput("");
  }

  function handleEditInput(): void {
    setShowInputPreview(false);
    setInput(pendingInput);
    setPendingInput("");
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.error} bold>
          DeepCode error
        </Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!runtime || !session) {
    return <Text>Carregando DeepCode...</Text>;
  }

  const activeApproval = approvals[0];

  return (
    <Layout
      height={stdout.rows}
      header={
        <Header
          provider={activeModeSelection?.provider ?? currentProviderId}
          model={activeModeSelection?.model || "não configurado"}
          agentMode={agentMode}
          theme={theme}
          providerStatus={activeProviderStatus}
        />
      }
      sidebar={
        <Sidebar
          theme={theme}
          activeTab={sidebarTab}
          sessions={sessionList}
          activities={activities}
          toolCalls={toolCalls}
          activeSessionId={session.id}
          status={status}
          activeTarget={activeTarget}
          messageCount={visibleMessages.length}
          approvalCount={approvals.length}
          currentApprovals={approvals}
          onTabChange={setSidebarTab}
          onApprovalAction={(requestId: string, allowed: boolean, scope: "once" | "session" | "always") => {
            resolveApproval(runtime, approvals.find(a => a.id === requestId), allowed, scope);
          }}
          telemetryStats={telemetry.stats}
          telemetryBreakdown={telemetry.toolBreakdown}
          currentPlan={currentPlan}
          hotkeysEnabled={sidebarHotkeysEnabled}
        />
      }
      statusBar={
        <StatusBar
          theme={theme}
          input={input}
          streaming={streaming}
          status={status}
          vimMode={vimMode}
          inputTokens={streaming ? liveTokens.input : (telemetry.stats?.inputTokens ?? 0)}
          outputTokens={streaming ? liveTokens.output : (telemetry.stats?.outputTokens ?? 0)}
          estimatedCost={streaming ? liveTokens.cost : (telemetry.stats?.estimatedCost ?? 0)}
          toolCalls={telemetry.stats?.toolCalls ?? 0}
          elapsed={elapsed}
          toolExecuting={toolExecuting}
          errorCount={telemetry.stats?.errorCount ?? 0}
          phase={phase}
          iteration={iteration}
          notice={notice}
          agentMode={agentMode}
          planSelection={planModeSelection}
          buildSelection={buildModeSelection}
        />
      }
    >
      <Box flexDirection="column" flexGrow={1}>
        {activeModal === "provider" && (
          <ErrorBoundary theme={theme} onReset={() => setActiveModal(null)}>
            <ProviderModal
              theme={theme}
              currentProvider={currentProviderId}
              providers={Object.entries(runtime.config.providers).map(([id, provider]) => ({
                id: id as ProviderId,
                name: PROVIDER_LABELS[id as ProviderId] ?? id,
                status: statuses[id as ProviderId] ?? EMPTY_PROVIDER_STATUS,
                hasApiKey: Boolean(provider.apiKey),
                hasApiKeyFile: Boolean(provider.apiKeyFile),
                expectedTarget: session
                  ? formatExpectedProviderTarget(
                      runtime.config,
                      session,
                      id as ProviderId,
                      agentMode,
                    )
                  : undefined,
              }))}
              onClose={() => setActiveModal(null)}
              onSelectProvider={async (providerId) => {
                try {
                  const updatedConfig = await saveConfigPatch(runtime, (mutable) => {
                    const modeDefaults = ((mutable.modeDefaults ?? {}) as Record<string, unknown>);
                    const modeOverride = ((modeDefaults[agentMode] ?? {}) as Record<string, unknown>);
                    const defaults = ((mutable.defaultModels ?? {}) as Record<string, unknown>);
                    const providerDefault = typeof defaults[providerId] === "string" ? defaults[providerId] : undefined;
                    modeOverride.provider = providerId;
                    if (providerDefault) {
                      modeOverride.model = providerDefault;
                    } else {
                      delete modeOverride.model;
                    }
                    modeDefaults[agentMode] = modeOverride;
                    mutable.modeDefaults = modeDefaults;
                  });
                  const next = {
                    ...session,
                    provider: providerId,
                    model: updatedConfig.modeDefaults?.[agentMode]?.model
                      ?? resolveConfiguredModelForProvider(updatedConfig, providerId),
                    updatedAt: new Date().toISOString(),
                  };
                  runtime.sessions.save(next);
                  void runtime.sessions.persist(next.id);
                  void telemetryRef.current?.createSession(next.id, next.provider, next.model || "unknown");
                  setSession(runtime.sessions.get(session.id));
                  if (!next.model) {
                    setActiveModal("model");
                    setNotice(
                      `Provider do modo ${agentMode.toUpperCase()} ativo: ${providerId}. Escolha um modelo para concluir a troca.`,
                    );
                  } else {
                    setNotice(`Provider do modo ${agentMode.toUpperCase()} ativo: ${providerId}`);
                  }
                } catch (err) {
                  setNotice(`Erro ao selecionar provider: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              onTestConnection={async (providerId) => {
                const healthCheck = buildProviderHealthCheck(runtime, session, providerId, agentMode);
                const result = await checkStatus(providerId, healthCheck);
                const label = PROVIDER_LABELS[providerId] ?? providerId;

                setNotice(
                  result.online
                    ? healthCheck.modelUnderTest
                      ? `Teste OK em ${label} com o modelo ${healthCheck.modelUnderTest}.`
                      : `Teste OK em ${label}. Credencial e endpoint responderam; escolha um modelo para validar chat.`
                    : `Falha ao testar ${label}: ${result.error ?? "erro desconhecido"}`,
                );
              }}
              onUpdateApiKey={async (providerId, apiKey) => {
                try {
                  await saveConfigPatch(runtime, (mutable) => {
                    const providers = (mutable.providers ?? {}) as Record<string, unknown>;
                    const provider = (providers[providerId] ?? {}) as Record<string, unknown>;
                    provider.apiKey = apiKey;
                    providers[providerId] = provider;
                    mutable.providers = providers;
                  });
                  setNotice(`API key atualizada para ${providerId}`);
                } catch (err) {
                  setNotice(`Erro ao atualizar API key: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              onUpdateApiKeyFile={async (providerId, apiKeyFile) => {
                try {
                  await saveConfigPatch(runtime, (mutable) => {
                    const providers = (mutable.providers ?? {}) as Record<string, unknown>;
                    const provider = (providers[providerId] ?? {}) as Record<string, unknown>;
                    provider.apiKeyFile = apiKeyFile;
                    delete provider.apiKey;
                    providers[providerId] = provider;
                    mutable.providers = providers;
                  });
                  setNotice(`Arquivo de API key configurado para ${providerId}`);
                } catch (err) {
                  setNotice(`Erro ao salvar arquivo de API key: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
            />
          </ErrorBoundary>
        )}

        {activeModal === "model" && (
          <ErrorBoundary theme={theme} onReset={() => setActiveModal(null)}>
            <ModelSelector
              theme={theme}
              models={models}
              loading={modelsLoading}
              error={modelsError}
              currentSelection={activeModeSelection}
              currentProvider={currentProviderId}
              recentSelections={recentModels}
              onSelect={(selection) => {
                void (async () => {
                  try {
                    await saveConfigPatch(runtime, (mutable) => {
                      const defaults = ((mutable.defaultModels ?? {}) as Record<string, unknown>);
                      defaults[selection.provider] = selection.model;
                      mutable.defaultModels = defaults;
                      const modeDefaults = ((mutable.modeDefaults ?? {}) as Record<string, unknown>);
                      modeDefaults[agentMode] = {
                        provider: selection.provider,
                        model: selection.model,
                      };
                      mutable.modeDefaults = modeDefaults;
                      if (selection.provider === runtime.config.defaultProvider) {
                        mutable.defaultModel = selection.model;
                      }
                    });
                    setRecentModels((current) => dedupeRecentModels([selection, ...current]));
                    const next = {
                      ...session,
                      provider: selection.provider,
                      model: selection.model,
                      updatedAt: new Date().toISOString(),
                    };
                    runtime.sessions.save(next);
                    void runtime.sessions.persist(next.id);
                    void telemetryRef.current?.createSession(next.id, next.provider, next.model || "unknown");
                    setSession(runtime.sessions.get(session.id));
                    setActiveModal(null);
                    setNotice(`Modelo do modo ${agentMode.toUpperCase()}: ${formatModelSelection(selection)}`);
                  } catch (err) {
                    setNotice(`Erro ao selecionar modelo: ${err instanceof Error ? err.message : String(err)}`);
                  }
                })();
              }}
              onRefresh={refreshModels}
              onClose={() => setActiveModal(null)}
            />
          </ErrorBoundary>
        )}

        {activeModal === "telemetry" && (
          <ErrorBoundary theme={theme} onReset={() => setActiveModal(null)}>
            <TelemetryPanel
              theme={theme}
              stats={telemetry.stats}
              allSessions={telemetry.allStats}
              toolBreakdown={telemetry.toolBreakdown}
              onExport={handleExportTelemetry}
              exportStatus={telemetryExportStatus}
              lastExportPath={lastExportPath}
              onClose={() => setActiveModal(null)}
            />
          </ErrorBoundary>
        )}

        {showInputPreview && (
          <InputPreview
            theme={theme}
            input={pendingInput}
            onConfirm={handleConfirmInput}
            onCancel={handleCancelInput}
            onEdit={handleEditInput}
            estimatedTokens={estimatedTokens}
          />
        )}

        {showSlashMenu && slashCommandSuggestions.length > 0 && (
          <SlashCommandMenu
            commands={slashCommandSuggestions}
            selectedIndex={selectedSlashCommandIndex}
            theme={theme}
          />
        )}

        {githubOAuth.status !== "idle" && (
          <GithubOAuthPanel
            state={githubOAuth}
            theme={theme}
          />
        )}

        {!activeModal && activeApproval && (
          <ApprovalPanel
            request={activeApproval}
            runtime={runtime}
            queueLength={approvals.length}
            theme={theme}
          />
        )}

        {!activeModal && viewMode === "sessions" && (
          <SessionSwitcher
            sessions={sessionList}
            selectedIndex={selectedSessionIndex}
            activeId={session.id}
            theme={theme}
          />
        )}

        {!activeModal && viewMode === "config" && (
          <ConfigEditor
            runtime={runtime}
            selectedIndex={configEditIndex}
            editing={editingConfig}
            editValue={configEditValue}
            saveStatus={configSaveStatus}
            theme={theme}
          />
        )}

        {!activeModal && viewMode === "help" && <HelpView theme={theme} />}

        {!activeModal && viewMode === "chat" && (
          <Box
            flexDirection="column"
            flexGrow={1}
            borderStyle="single"
            borderColor={theme.border}
            paddingX={1}
          >
            <Box marginBottom={1}>
              <Text bold color={theme.primary}>
                Chat
              </Text>
              <Text color={theme.fgMuted}> {" "}{session.id}</Text>
            </Box>
            {currentPlan && streaming && (
              <PlanProgressBar plan={currentPlan} theme={theme} />
            )}
            <Box flexDirection="column" flexGrow={1}>
              {visibleMessages.length === 0 && !streaming ? (
                <EmptyChatState
                  theme={theme}
                  session={session}
                  status={status}
                  activeTarget={activeTarget}
                  planSelection={planModeSelection}
                  buildSelection={buildModeSelection}
                  approvalCount={approvals.length}
                />
              ) : (
                <>
                  {visibleMessages.map((msg) => (
                    <Box key={msg.id} flexDirection="column">
                      <Text color={msg.role === "user" ? theme.userMsg : theme.assistantMsg} bold>
                        {msg.role === "user" ? "Você" : "DeepCode"}
                      </Text>
                      <Text>{redactText(msg.content, collectSecretValues(runtime.config))}</Text>
                      <Text> </Text>
                    </Box>
                  ))}
                  {approvals.length > 0 && activeApproval && (
                    <ChatApprovalIndicator request={activeApproval} theme={theme} />
                  )}
                  {streaming && assistantDraft && (
                    <Box flexDirection="column">
                      <Box gap={1}>
                        <Text color={theme.assistantMsg} bold>
                          DeepCode (rascunho)
                        </Text>
                        <TypingIndicator theme={theme} />
                      </Box>
                      <Text dimColor>{assistantDraft}</Text>
                      <Text> </Text>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Layout>
  );
}

export { CONFIG_FIELDS } from "./app-config.js";
export {
  buildProviderHealthCheck,
  extractTaskPlanFromSession,
  formatAgentRunError,
  getChatPreflightIssue,
  getModelPricing,
  getRenderableChatMessages,
  getSlashCommandSuggestions,
  getSlashMenuAction,
  isSidebarHotkeysEnabled,
  isSlashCommandInput,
  parseGithubLoginClientId,
  recordAgentRunError,
  selectInitialSessionForLaunch,
  shouldUseSelectedSlashCommand,
} from "./app-utils.js";

