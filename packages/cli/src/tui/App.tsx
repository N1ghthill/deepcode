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
  useGithubOAuth,
  useApprovalFlow,
  useConfigEditor,
  useSessionManager,
  useLiveMetrics,
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
} from "./app-config.js";
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
  recordAgentRunError,
  selectInitialSessionForLaunch,
  serializeConfigEditValue,
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
import { t, setLanguage } from "./i18n/index.js";

export function App(props: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [runtime, setRuntime] = useState<DeepCodeRuntime | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [status, setStatus] = useState("loading");
  const [notice, setNotice] = useState(t("initialNotice"));
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [vimMode, setVimMode] = useState<VimMode>("insert");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("sessions");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("build");
  const [showInputPreview, setShowInputPreview] = useState(false);
  const [pendingInput, setPendingInput] = useState("");
  const [selectedSlashCommandIndex, setSelectedSlashCommandIndex] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<TaskPlan | undefined>();
  const [recentModels, setRecentModels] = useState<RecentModelSelection[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const telemetryRef = useRef<TelemetryCollector | null>(null);
  const uiStateRef = useRef<UIStateManager | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ id: string; name: string; args: string; result?: string }>>([]);
  const [toolExecuting, setToolExecuting] = useState(false);
  const [phase, setPhase] = useState("");
  const [iteration, setIteration] = useState({ current: 0, max: 0 });
  const [telemetryCollector, setTelemetryCollector] = useState<TelemetryCollector | null>(null);
  const [telemetryExportStatus, setTelemetryExportStatus] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);

  const applyUpdatedConfig = useCallback((activeRuntime: DeepCodeRuntime, updatedConfig: DeepCodeRuntime["config"]) => {
    Object.assign(activeRuntime.config, updatedConfig);
    activeRuntime.providers.reload(activeRuntime.config);
    setRuntime((prev) => (prev ? { ...prev, config: activeRuntime.config } : prev));
  }, []);

  const handleSessionUpdate = useCallback((next: Session, extras?: {
    messages?: Message[];
    activities?: Activity[];
    toolCalls?: Array<{ id: string; name: string; args: string; result?: string }>;
    status?: string;
    currentPlan?: TaskPlan | undefined;
    viewMode?: ViewMode;
    vimMode?: VimMode;
    assistantDraft?: string;
  }) => {
    setSession(next);
    if (extras?.messages !== undefined) setMessages(extras.messages);
    if (extras?.activities !== undefined) setActivities(extras.activities);
    if (extras?.toolCalls !== undefined) setToolCalls(extras.toolCalls);
    if (extras?.status !== undefined) setStatus(extras.status);
    if (extras?.currentPlan !== undefined) setCurrentPlan(extras.currentPlan);
    if (extras?.viewMode !== undefined) setViewMode(extras.viewMode);
    if (extras?.vimMode !== undefined) setVimMode(extras.vimMode);
    if (extras?.assistantDraft !== undefined) setAssistantDraft(extras.assistantDraft);
  }, []);

  const { githubOAuth, abortRef: githubOAuthAbortRef, startGithubLogin, cancelOAuth } = useGithubOAuth({ cwd: props.cwd, configPath: props.config, setNotice, applyUpdatedConfig });
  const { approvals, setApprovals, resolveApproval } = useApprovalFlow();
  const { configEditIndex, setConfigEditIndex, configEditValue, setConfigEditValue, editingConfig, setEditingConfig, configSaveStatus, saveConfigEdit, saveConfigPatch, resetEditor } = useConfigEditor({ cwd: props.cwd, configPath: props.config, applyUpdatedConfig });
  const { activateTelemetrySession, createNewSession, switchSession } = useSessionManager({ telemetryRef, activeSessionIdRef, onUpdateSession: handleSessionUpdate });
  const { liveTokens, elapsed, resetMetrics, recordTokenUsage } = useLiveMetrics(streaming);

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

        setLanguage(created.config.tui.language);

        const uiStateManager = new UIStateManager(props.cwd);
        uiStateRef.current = uiStateManager;

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
            t("approvalPending", { operation: redactText(request.operation, collectSecretValues(created.config)) }),
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
          created.permissions.rejectAllPending("Session ended");
          created.permissions.clearSessionAllowSet();
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
  }, [activateTelemetrySession, props.cwd, props.config, setApprovals]);

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
    if (key.ctrl && inputChar === "q") {
      saveUIState();
      abortRef.current?.abort();
      githubOAuthAbortRef.current?.abort();
      exit();
      return;
    }

    if (key.ctrl && inputChar === "c") {
      if (githubOAuth.status !== "idle") {
        cancelOAuth();
      } else if (streaming) {
        abortRef.current?.abort();
        setStreaming(false);
        setStatus("cancelled");
        setNotice(t("executionCancelled"));
      } else {
        exit();
      }
      return;
    }

    if (!runtime || !session) return;

    if (githubOAuthAbortRef.current || githubOAuth.status === "waiting") {
      if (key.escape) {
        cancelOAuth();
        return;
      }
      if (inputChar?.toLowerCase() === "r") {
        void startGithubLogin("/github-login", runtime, session);
        return;
      }
      return;
    }

    if (activeModal) {
      if (key.escape) {
        setActiveModal(null);
        setNotice(t("modalClosed"));
        return;
      }
      return;
    }

    if (approvals.length > 0) {
      if (inputChar?.toLowerCase() === "a") {
        resolveApproval(runtime, approvals[0], true, "once", { setNotice, setStatus });
        return;
      }
      if (inputChar?.toLowerCase() === "l") {
        resolveApproval(runtime, approvals[0], true, "always", { setNotice, setStatus });
        return;
      }
      if (inputChar?.toLowerCase() === "s") {
        resolveApproval(runtime, approvals[0], true, "session", { setNotice, setStatus });
        return;
      }
      if (inputChar?.toLowerCase() === "d" || inputChar?.toLowerCase() === "n") {
        resolveApproval(runtime, approvals[0], false, "once", { setNotice, setStatus });
        return;
      }
      if (key.escape) {
        resolveApproval(runtime, approvals[0], false, "once", { setNotice, setStatus });
        return;
      }
      return;
    }

    if (showInputPreview) {
      if (key.escape || key.return) {
        setShowInputPreview(false);
        return;
      }
      return;
    }

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
          switchSession(selected, runtime);
          setApprovals([]);
          setNotice(t("activeSession", { id: selected.id }));
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice(t("chatActive"));
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
        setNotice(t("chatActive"));
        return;
      }
      return;
    }

    if (viewMode === "help") {
      if (key.escape || key.return || inputChar?.toLowerCase() === "q") {
        setViewMode("chat");
        setVimMode("insert");
        setNotice(t("chatActive"));
      }
      return;
    }

    if (key.ctrl && inputChar === "h") {
      setViewMode("help");
      setVimMode("normal");
      setNotice(t("helpOpenedEscapeToReturn"));
      return;
    }

    if (key.ctrl && inputChar === "o") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice(t("selectSessionEscapeToReturn"));
      return;
    }

    if (key.ctrl && inputChar === "n") {
      const newSession = createNewSession(runtime, agentMode);
      setApprovals([]);
      setNotice(t("newSession", { id: newSession.id }));
      return;
    }

    if (key.ctrl && inputChar === "p") {
      setActiveModal("provider");
      setNotice(t("providerModalOpenedEscapeToClose"));
      return;
    }

    if (key.ctrl && inputChar === "m") {
      setActiveModal("model");
      setNotice(t("modelSelectorOpenedEscapeToClose", { mode: agentMode.toUpperCase() }));
      return;
    }

    if (key.ctrl && inputChar === "t") {
      setActiveModal("telemetry");
      setNotice(t("appTelemetryPanelOpened"));
      return;
    }

    if (key.tab && !key.ctrl && !showSlashMenu) {
      setAgentMode((current) => {
        const next = current === "build" ? "plan" : "build";
        const nextSelection = runtime && session ? resolveEffectiveModeSelection(runtime.config, session, next) : null;
        setNotice(
          nextSelection
            ? t("modeChangedWithModel", { mode: next.toUpperCase(), model: formatModelSelection(nextSelection) })
            : t("modeChanged", { mode: next.toUpperCase() }),
        );
        return next;
      });
      return;
    }

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
          ? t("normalModeActiveInsert")
          : t("normalModeActiveContinueEditing"),
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
        setNotice(t("commandCancelled"));
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
    setNotice(t("executingTask"));
    setToolCalls([]);
    setCurrentPlan(undefined);
    setToolExecuting(false);
    setPhase("planning");
    setIteration({ current: 0, max: 0 });
    resetMetrics();

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
        recordTokenUsage(inputTokens, outputTokens, cost);
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
        const progress = plan.tasks.filter((task) => task.status === "completed").length;
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
        setNotice(t("planningFailed", { error: planError }));
      } else {
        setNotice(t("taskCompleted"));
      }
    } catch (err) {
      const message = await recordAgentRunError(activeRuntime, activeSession, err);
      setMessages([...activeSession.messages]);
      setActivities(activeSession.activities.slice(-10));
      setStatus("error");
      setCurrentPlan(extractTaskPlanFromSession(activeSession));
      setNotice(t("error", { message }));
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
      setNotice(t("helpOpened"));
      return;
    }
    if (name === "/clear") {
      setMessages([]);
      setAssistantDraft("");
      setNotice(t("screenCleared"));
      return;
    }
    if (name === "/new") {
      const newSession = createNewSession(activeRuntime, agentMode);
      setApprovals([]);
      setNotice(t("newSession", { id: newSession.id }));
      return;
    }
    if (name === "/sessions") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice(t("selectSessionEscapeToReturn"));
      return;
    }
    if (name === "/config") {
      resetEditor();
      setViewMode("config");
      setVimMode("normal");
      setNotice(t("configNavigateEdit"));
      return;
    }
    if (name === "/provider" || name === "/providers") {
      setActiveModal("provider");
      setNotice(t("providerModalOpened"));
      return;
    }
    if (name === "/model" || name === "/models") {
      setActiveModal("model");
      setNotice(t("modelSelectorOpenedEscapeToClose", { mode: agentMode.toUpperCase() }));
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
            ? t("modeChangedWithModel", { mode: value.toUpperCase(), model: formatModelSelection(nextSelection) })
            : t("modeChanged", { mode: value.toUpperCase() }),
        );
        return;
      }
      setNotice(t("modeUsage"));
      return;
    }
    if (name === "/github-login" || command.startsWith("/github login")) {
      void startGithubLogin(command, activeRuntime, session);
      return;
    }
    setNotice(t("unknownCommand", { command }));
  }

  async function handleExportTelemetry(): Promise<void> {
    if (!telemetryCollector || !session) return;

    setTelemetryExportStatus("exporting");
    try {
      const exportPath = await telemetryCollector.exportToJson(session.id);
      setLastExportPath(exportPath);
      setTelemetryExportStatus("success");
      setNotice(t("telemetryExported", { path: exportPath }));
      setTimeout(() => setTelemetryExportStatus("idle"), 5000);
    } catch (err) {
      setTelemetryExportStatus("error");
      setNotice(t("exportError", { error: err instanceof Error ? err.message : String(err) }));
      setTimeout(() => setTelemetryExportStatus("idle"), 5000);
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
          {t("appDeepCodeError")}
        </Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!runtime || !session) {
    return <Text>{t("loadingDeepCode")}</Text>;
  }

  const activeApproval = approvals[0];

  return (
    <Layout
      height={stdout.rows}
      header={
        <Header
          provider={activeModeSelection?.provider ?? currentProviderId}
          model={activeModeSelection?.model || t("notConfigured")}
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
            resolveApproval(runtime, approvals.find(a => a.id === requestId), allowed, scope, { setNotice, setStatus });
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
                      t("providerForModeActiveChooseModel", { mode: agentMode.toUpperCase(), provider: providerId }),
                    );
                  } else {
                    setNotice(t("providerForModeActive", { mode: agentMode.toUpperCase(), provider: providerId }));
                  }
                } catch (err) {
                  setNotice(t("errorSelectingProvider", { error: err instanceof Error ? err.message : String(err) }));
                }
              }}
              onTestConnection={async (providerId) => {
                const healthCheck = buildProviderHealthCheck(runtime, session, providerId, agentMode);
                const result = await checkStatus(providerId, healthCheck);
                const label = PROVIDER_LABELS[providerId] ?? providerId;

                setNotice(
                  result.online
                    ? healthCheck.modelUnderTest
                      ? t("testOkWithModel", { label, model: healthCheck.modelUnderTest })
                      : t("testOkChooseModel", { label })
                    : t("testFailedLabel", { label, error: result.error ?? "unknown error" }),
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
                  setNotice(t("apiKeyUpdated", { provider: providerId }));
                } catch (err) {
                  setNotice(t("errorUpdatingApiKey", { error: err instanceof Error ? err.message : String(err) }));
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
                  setNotice(t("apiKeyFileConfigured", { provider: providerId }));
                } catch (err) {
                  setNotice(t("errorSavingApiKeyFile", { error: err instanceof Error ? err.message : String(err) }));
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
                    setNotice(t("modelForMode", { mode: agentMode.toUpperCase(), model: formatModelSelection(selection) }));
                  } catch (err) {
                    setNotice(t("errorSelectingModel", { error: err instanceof Error ? err.message : String(err) }));
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
                {t("appChatLabel")}
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
                        {msg.role === "user" ? t("you") : t("deepCodeLabel")}
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
                          {t("deepCodeDraft")}
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