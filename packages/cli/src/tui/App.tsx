import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { DetailContent } from "./types.js";
import {
  resolveConfiguredModelForProvider,
  type AgentMode,
  type Session,
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
  Header,
  Sidebar,
  StatusBar,
} from "./components/layout/index.js";
import { AppLayout } from "./components/AppLayout.js";
import { useUIStore } from "./store/ui-store.js";
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
  useGitStatus,
  useFileTree,
  useAutocomplete,
} from "./hooks/index.js";
import { UIStateManager, type UIState } from "./persistence/ui-state.js";
import { ErrorBoundary } from "./components/shared/ErrorBoundary.js";
import { useTokenEstimate } from "./hooks/useTokenEstimate.js";
import type { AppProps, ViewMode, VimMode } from "./types.js";
import { formatModelSelection } from "./model-selection.js";
import {
  resolveEffectiveModeProvider,
  resolveEffectiveModeSelection,
} from "./mode-routing.js";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
} from "./app-config.js";
import {
  buildProviderHealthCheck,
  dedupeRecentModels,
  extractTaskPlanFromSession,
  formatExpectedProviderTarget,
  getChatPreflightIssue,
  getRenderableChatMessages,
  getSlashCommandSuggestions,
  isSidebarHotkeysEnabled,
  isSlashCommandInput,
  selectInitialSessionForLaunch,
} from "./app-utils.js";
import {
  ApprovalPanel,
  ChatApprovalIndicator,
  ConfigEditor,
  EmptyChatState,
  GithubOAuthPanel,
  HelpView,
  SessionSwitcher,
  SlashCommandMenu,
} from "./components/views/AppPanels.js";
import { MessageList } from "./components/chat/MessageList.js";
import { InputField } from "./components/chat/InputField.js";
import { ParallelTasksPanel } from "./components/tasks/ParallelTasksPanel.js";
import { ProgressMatrix } from "./components/tasks/ProgressMatrix.js";
import { TaskProgress } from "./components/TaskProgress.js";
import { HistorySearch } from "./components/HistorySearch.js";
import { SessionTimeline } from "./components/SessionTimeline.js";
import { OAuthWizard } from "./components/OAuthWizard.js";
import { CommandSuggestions } from "./components/CommandSuggestions.js";
import { PreviewOverlay } from "./components/PreviewOverlay.js";
import { usePreview } from "./hooks/usePreview.js";
import { ConfigPanel } from "./components/ConfigPanel.js";
import { FileTreePanel } from "./components/FileTreePanel.js";
import { CONFIG_FIELDS } from "./app-config.js";
import { useExecutionStore } from "./store/execution-store.js";
import { useAgentStore } from "./store/agent-store.js";
import { useConfigStore } from "./store/config-store.js";
import { useAgentBridge } from "./hooks/useAgentBridge.js";
import { useChatInput } from "./hooks/useChatInput.js";
import { useSessionInput } from "./hooks/useSessionInput.js";
import { useConfigInput } from "./hooks/useConfigInput.js";
import { t, setLanguage } from "./i18n/index.js";

export function App(props: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [contextView, setContextView] = React.useState<"sidebar" | "files">("sidebar");

  // ── Store slices ──────────────────────────────────────────────────────────
  const runtime = useAgentStore((s) => s.runtime);
  const session = useAgentStore((s) => s.session);
  const input = useAgentStore((s) => s.input);
  const messages = useAgentStore((s) => s.messages);
  const activities = useAgentStore((s) => s.activities);
  const streaming = useAgentStore((s) => s.streaming);
  const assistantDraft = useAgentStore((s) => s.assistantDraft);
  const status = useAgentStore((s) => s.status);
  const notice = useAgentStore((s) => s.notice);
  const error = useAgentStore((s) => s.error);
  const viewMode = useAgentStore((s) => s.viewMode);
  const selectedSessionIndex = useAgentStore((s) => s.selectedSessionIndex);
  const vimMode = useAgentStore((s) => s.vimMode);
  const sidebarTab = useAgentStore((s) => s.sidebarTab);
  // sidebarVisible is kept in store for potential consumers but layout is now UIStore-driven
  const activeModal = useAgentStore((s) => s.activeModal);
  const agentMode = useAgentStore((s) => s.agentMode);
  const showInputPreview = useAgentStore((s) => s.showInputPreview);
  const pendingInput = useAgentStore((s) => s.pendingInput);
  const currentPlan = useAgentStore((s) => s.currentPlan);
  const taskBuffers = useAgentStore((s) => s.taskBuffers);
  const toolCalls = useAgentStore((s) => s.toolCalls);
  const toolExecuting = useAgentStore((s) => s.toolExecuting);
  const phase = useAgentStore((s) => s.phase);
  const iteration = useAgentStore((s) => s.iteration);
  const recentModels = useAgentStore((s) => s.recentModels);
  const telemetryExportStatus = useAgentStore((s) => s.telemetryExportStatus);
  const lastExportPath = useAgentStore((s) => s.lastExportPath);
  const slashMenuDismissed = useAgentStore((s) => s.slashMenuDismissed);
  const selectedSlashCommandIndex = useAgentStore((s) => s.selectedSlashCommandIndex);
  const showHistorySearch = useAgentStore((s) => s.showHistorySearch);
  const detailContent = useAgentStore((s) => s.detailContent);

  const setRuntime = useAgentStore((s) => s.setRuntime);
  const setSession = useAgentStore((s) => s.setSession);
  const setInput = useAgentStore((s) => s.setInput);
  const setMessages = useAgentStore((s) => s.setMessages);
  const setActivities = useAgentStore((s) => s.setActivities);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setNotice = useAgentStore((s) => s.setNotice);
  const setError = useAgentStore((s) => s.setError);
  const setViewMode = useAgentStore((s) => s.setViewMode);
  const setVimMode = useAgentStore((s) => s.setVimMode);
  const setSidebarTab = useAgentStore((s) => s.setSidebarTab);
  const setActiveModal = useAgentStore((s) => s.setActiveModal);
  const setAgentMode = useAgentStore((s) => s.setAgentMode);
  const setShowInputPreview = useAgentStore((s) => s.setShowInputPreview);
  const setPendingInput = useAgentStore((s) => s.setPendingInput);
  const setCurrentPlan = useAgentStore((s) => s.setCurrentPlan);
  const setToolCalls = useAgentStore((s) => s.setToolCalls);
  const setRecentModels = useAgentStore((s) => s.setRecentModels);
  const setTelemetryExportStatus = useAgentStore((s) => s.setTelemetryExportStatus);
  const setLastExportPath = useAgentStore((s) => s.setLastExportPath);
  const setShowHistorySearch = useAgentStore((s) => s.setShowHistorySearch);
  const setDetailContent = useAgentStore((s) => s.setDetailContent);
  const dispatch = useAgentStore((s) => s.dispatch);

  // Execution store (for TaskProgress)
  const executionTasks = useExecutionStore((s) => s.tasks);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const telemetryRef = useRef<TelemetryCollector | null>(null);
  const uiStateRef = useRef<UIStateManager | null>(null);

  // ── Telemetry / providers / models ───────────────────────────────────────
  const [telemetryCollector, setTelemetryCollector] = React.useState<TelemetryCollector | null>(null);

  const applyUpdatedConfig = useCallback(
    (activeRuntime: DeepCodeRuntime, updatedConfig: DeepCodeRuntime["config"]) => {
      Object.assign(activeRuntime.config, updatedConfig);
      activeRuntime.providers.reload(activeRuntime.config);
      setRuntime(activeRuntime ? { ...activeRuntime, config: activeRuntime.config } : null);
    },
    [setRuntime],
  );

  const handleSessionUpdate = useCallback(
    (next: Session, extras?: {
      messages?: typeof messages;
      activities?: typeof activities;
      toolCalls?: typeof toolCalls;
      status?: string;
      currentPlan?: TaskPlan | undefined;
      viewMode?: ViewMode;
      vimMode?: VimMode;
    }) => {
      setSession(next);
      if (extras?.messages !== undefined) setMessages(extras.messages);
      if (extras?.activities !== undefined) setActivities(extras.activities);
      if (extras?.toolCalls !== undefined) setToolCalls(extras.toolCalls);
      if (extras?.status !== undefined) setStatus(extras.status);
      if (extras?.currentPlan !== undefined) setCurrentPlan(extras.currentPlan);
      if (extras?.viewMode !== undefined) setViewMode(extras.viewMode);
      if (extras?.vimMode !== undefined) setVimMode(extras.vimMode);
    },
    [setSession, setMessages, setActivities, setToolCalls, setStatus, setCurrentPlan, setViewMode, setVimMode],
  );

  const { githubOAuth, abortRef: githubOAuthAbortRef, startGithubLogin, cancelOAuth } =
    useGithubOAuth({ cwd: props.cwd, configPath: props.config, setNotice, applyUpdatedConfig });
  const { approvals, setApprovals, resolveApproval } = useApprovalFlow();
  const { previewState, openPreview, closePreview, nextFile, prevFile } = usePreview();
  const {
    configEditIndex,
    setConfigEditIndex,
    configEditValue,
    setConfigEditValue,
    editingConfig,
    setEditingConfig,
    configSaveStatus,
    saveConfigEdit,
    saveConfigPatch,
    resetEditor,
  } = useConfigEditor({ cwd: props.cwd, configPath: props.config, applyUpdatedConfig });
  const { activateTelemetrySession, createNewSession, switchSession } = useSessionManager({
    telemetryRef,
    activeSessionIdRef,
    onUpdateSession: handleSessionUpdate,
  });
  const { liveTokens, elapsed, resetMetrics, recordTokenUsage } = useLiveMetrics(streaming);
  const gitStatus = useGitStatus(props.cwd);
  const fileTree = useFileTree(props.cwd);
  const autocompleteSuggestions = useAutocomplete(input, fileTree);

  // ── Agent bridge (replaces inline agent.run + all state mutations) ────────
  const providerEntries = useMemo(() => {
    if (!runtime) return [];
    return PROVIDER_IDS.map((providerId) => ({
      id: providerId,
      provider: {
        listModels: async (options?: { signal?: AbortSignal }) =>
          runtime.providers.get(providerId).listModels(options),
      },
      enabled: Boolean(
        runtime.config.providers[providerId]?.apiKey ||
        runtime.config.providers[providerId]?.apiKeyFile,
      ),
    }));
  }, [runtime]);

  const { models, loading: modelsLoading, error: modelsError, refresh: refreshModels } =
    useModelCatalog(providerEntries);

  const { runAgent } = useAgentBridge({
    models,
    telemetryRef,
    activeSessionIdRef,
    abortRef,
    recordTokenUsage,
    resetMetrics,
  });

  // ── Runtime initialization ────────────────────────────────────────────────
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
          useAgentStore.getState().setSelectedSessionIndex(savedState.selectedSessionIndex);
          useAgentStore.getState().setHistory(savedState.inputHistory);
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
          dispatch({ type: "ACTIVITY", activity });
          const meta = activity.metadata;
          if (meta && meta.tool) {
            useAgentStore.getState().setToolExecuting(true);
            setToolCalls((current) => [
              ...current.slice(-8),
              {
                id: activity.id,
                name: String(meta.tool),
                args: meta.args ? JSON.stringify(meta.args) : "",
              },
            ]);
            telemetryRef.current?.recordToolCall(
              activeSessionIdRef.current ?? active.id,
              String(meta.tool),
            );
          }
        });
        const offApproval = created.events.on("approval:request", (request) => {
          setApprovals((current) => [...current, request]);
          setStatus("awaiting approval");
          setNotice(
            t("approvalPending", {
              operation: redactText(request.operation, collectSecretValues(created.config)),
            }),
          );
        });
        const offError = created.events.on("app:error", ({ error: err }) => {
          setNotice(redactText(err.message, collectSecretValues(created.config)));
          telemetryRef.current?.recordError(
            activeSessionIdRef.current ?? active.id,
            "agent_error",
            err.message,
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
        setActivities(active.activities.slice(-100));
        setStatus(active.status);
        setCurrentPlan(extractTaskPlanFromSession(active));
        setNotice(t("initialNotice"));
      })
      .catch((err: unknown) =>
        setError(redactText(err instanceof Error ? err.message : String(err))),
      );

    return () => {
      mounted = false;
      cleanupRuntime?.();
    };
  }, [activateTelemetrySession, props.cwd, props.config, setApprovals, dispatch]);

  // ── Sidebar plan tab cleanup ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentPlan && sidebarTab === "plan") {
      setSidebarTab("activities");
    }
  }, [currentPlan, sidebarTab, setSidebarTab]);

  // ── Open PreviewOverlay when an approval carries a diff ───────────────────
  const firstApproval = approvals[0];
  useEffect(() => {
    if (firstApproval?.diff) {
      openPreview(firstApproval.operation, [
        {
          path: firstApproval.diff.filePath,
          action: "modify",
          before: firstApproval.diff.before,
          after: firstApproval.diff.after,
        },
      ]);
    } else {
      closePreview();
    }
  }, [firstApproval?.id, firstApproval?.diff]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    useAgentStore.getState().setSelectedSlashCommandIndex(0);
    useAgentStore.getState().setSlashMenuDismissed(false);
  }, [input]);

  // ── Sync runtime/session/git state into ConfigStore ──────────────────────
  useEffect(() => {
    if (!session) return;
    const cs = useConfigStore.getState();
    cs.setActiveProvider(session.provider as Parameters<typeof cs.setActiveProvider>[0]);
    cs.setActiveModel(session.model ?? "");
    cs.setAgentMode(agentMode);
  }, [session?.provider, session?.model, agentMode]);

  useEffect(() => {
    const cs = useConfigStore.getState();
    cs.setGitBranch(gitStatus.branch);
    cs.setGitStatus(gitStatus.status);
  }, [gitStatus.branch, gitStatus.status]);

  // ── Theme / derived values ─────────────────────────────────────────────────
  const theme = useMemo(
    () => (runtime ? getTheme(runtime.config.tui.theme) : getTheme("dark")),
    [runtime?.config.tui.theme],
  );

  const { statuses, checkStatus } = useProviderStatus();
  const telemetry = useTelemetry(session?.id ?? "", telemetryCollector);
  const sessionList = runtime ? runtime.sessions.list() : [];
  const visibleMessages = useMemo(() => getRenderableChatMessages(messages), [messages]);
  const estimatedTokens = useTokenEstimate(pendingInput);
  const slashCommandSuggestions = useMemo(
    () => getSlashCommandSuggestions(input),
    [input],
  );

  const activeProviderId: ProviderId = useMemo(() => {
    if (!runtime || !session) return "openrouter";
    const activeModeSelection = resolveEffectiveModeSelection(runtime.config, session, agentMode);
    return activeModeSelection?.provider ?? resolveEffectiveModeProvider(runtime.config, session, agentMode);
  }, [runtime, session, agentMode]);

  const activeModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, agentMode)
    : null;
  const planModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, "plan")
    : null;
  const buildModeSelection = runtime && session
    ? resolveEffectiveModeSelection(runtime.config, session, "build")
    : null;
  const activeTarget = activeModeSelection ? formatModelSelection(activeModeSelection) : undefined;
  const activeProviderStatus = getScopedProviderStatus(
    statuses[activeProviderId],
    activeTarget,
  );

  const showSlashMenu =
    viewMode === "chat" &&
    vimMode === "insert" &&
    !activeModal &&
    !streaming &&
    !showInputPreview &&
    !slashMenuDismissed &&
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

  // ── Save UI state ──────────────────────────────────────────────────────────
  const saveUIState = useCallback(() => {
    if (!uiStateRef.current || !session) return;
    const s = useAgentStore.getState();
    const stateToSave: UIState = {
      lastActiveSessionId: session.id,
      lastSessionTimestamp: Date.now(),
      viewMode: s.viewMode,
      sidebarTab: s.sidebarTab,
      agentMode: s.agentMode,
      vimMode: s.vimMode,
      selectedSessionIndex: s.selectedSessionIndex,
      inputHistory: s.history,
      modals: { providerExpanded: false, modelFilter: "", recentModels: s.recentModels },
      version: 1,
      savedAt: new Date().toISOString(),
    };
    void uiStateRef.current.save(stateToSave);
  }, [session]);

  // ── Global input handler (Ctrl shortcuts, OAuth, modal dismiss, approvals) ─
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
        setStatus("cancelled");
        setNotice(t("executionCancelled"));
      } else {
        exit();
      }
      return;
    }

    if (!runtime || !session) return;

    // OAuth mode
    if (githubOAuthAbortRef.current || githubOAuth.status === "waiting") {
      if (key.escape) { cancelOAuth(); return; }
      if (inputChar?.toLowerCase() === "r") {
        void startGithubLogin("/github-login", runtime, session);
        return;
      }
      return;
    }

    // Modal dismiss
    if (activeModal) {
      if (key.escape) { setActiveModal(null); setNotice(t("modalClosed")); }
      return;
    }

    // Approval keys
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
      if (inputChar?.toLowerCase() === "d" || inputChar?.toLowerCase() === "n" || key.escape) {
        resolveApproval(runtime, approvals[0], false, "once", { setNotice, setStatus });
        return;
      }
      return;
    }

    // Input preview
    if (showInputPreview) {
      if (key.escape || key.return) { setShowInputPreview(false); }
      return;
    }

    // Help view
    if (viewMode === "help") {
      if (key.escape || key.return || inputChar?.toLowerCase() === "q") {
        setViewMode("chat");
        setVimMode("insert");
        setNotice(t("chatActive"));
      }
      return;
    }

    // Global navigation shortcuts
    if (key.ctrl && inputChar === "h") {
      setViewMode("help"); setVimMode("normal");
      setNotice(t("helpOpenedEscapeToReturn")); return;
    }
    if (key.ctrl && inputChar === "o") {
      useAgentStore.getState().setSelectedSessionIndex(0);
      setViewMode("sessions"); setVimMode("normal");
      setNotice(t("selectSessionEscapeToReturn")); return;
    }
    if (key.ctrl && inputChar === "n") {
      const newSession = createNewSession(runtime, agentMode);
      setApprovals([]); setNotice(t("newSession", { id: newSession.id })); return;
    }
    if (key.ctrl && inputChar === "p") {
      setActiveModal("provider"); setNotice(t("providerModalOpenedEscapeToClose")); return;
    }
    if (key.ctrl && inputChar === "m") {
      setActiveModal("model");
      setNotice(t("modelSelectorOpenedEscapeToClose", { mode: agentMode.toUpperCase() })); return;
    }
    if (key.ctrl && inputChar === "t") {
      setActiveModal("telemetry"); setNotice(t("appTelemetryPanelOpened")); return;
    }
    if (key.ctrl && inputChar === "b") {
      useUIStore.getState().togglePanel("context");
      return;
    }
    if (key.ctrl && inputChar === "f") {
      setContextView((v) => (v === "sidebar" ? "files" : "sidebar"));
      useUIStore.getState().openPanel("context");
      return;
    }
    if (key.ctrl && inputChar === ",") {
      const nextDetail: DetailContent = detailContent === "config" ? "none" : "config";
      setDetailContent(nextDetail);
      if (nextDetail !== "none") {
        useUIStore.getState().openPanel("detail");
      } else {
        useUIStore.getState().closePanel("detail");
      }
      return;
    }
    // History search (Ctrl+R)
    if (key.ctrl && inputChar === "r" && !streaming && vimMode === "insert") {
      setShowHistorySearch(true);
      return;
    }
    // Timeline (Ctrl+L)
    if (key.ctrl && inputChar === "l") {
      const nextDetail: DetailContent = detailContent === "timeline" ? "none" : "timeline";
      setDetailContent(nextDetail);
      if (nextDetail !== "none") {
        useUIStore.getState().openPanel("detail");
      } else {
        useUIStore.getState().closePanel("detail");
      }
      return;
    }
    // Close history search or detail panel
    if (showHistorySearch && key.escape) {
      setShowHistorySearch(false);
      return;
    }

    // Tab toggle mode
    if (key.tab && !key.ctrl && !showSlashMenu) {
      setAgentMode((current) => {
        const next: AgentMode = current === "build" ? "plan" : "build";
        const nextSelection = runtime && session
          ? resolveEffectiveModeSelection(runtime.config, session, next)
          : null;
        setNotice(
          nextSelection
            ? t("modeChangedWithModel", { mode: next.toUpperCase(), model: formatModelSelection(nextSelection) })
            : t("modeChanged", { mode: next.toUpperCase() }),
        );
        return next;
      });
      return;
    }
  });

  // ── Per-mode input handlers ────────────────────────────────────────────────
  useChatInput({
    isActive: viewMode === "chat" && !activeModal && approvals.length === 0 && !showInputPreview && githubOAuth.status === "idle",
    runtime,
    session,
    showSlashMenu,
    slashCommandSuggestions,
    onSubmit: (prompt) => void handleSubmit(prompt),
    onCommand: (command) => handleCommand(command, runtime!),
  });

  useSessionInput({
    isActive: viewMode === "sessions",
    runtime,
    onSwitchSession: (idx, rt) => {
      const selected = rt.sessions.list()[idx];
      if (selected) {
        switchSession(selected, rt);
        setApprovals([]);
        setNotice(t("activeSession", { id: selected.id }));
      }
    },
    onClearApprovals: () => setApprovals([]),
  });

  useConfigInput({
    isActive: viewMode === "config",
    runtime,
    configEditIndex,
    setConfigEditIndex,
    editingConfig,
    setEditingConfig,
    configEditValue,
    setConfigEditValue,
    onSave: (field, value) => void saveConfigEdit(runtime!, field, value),
  });

  // ── Submit + command handlers ──────────────────────────────────────────────
  async function handleSubmit(prompt: string): Promise<void> {
    if (!prompt || !runtime || !session) return;

    if (isSlashCommandInput(prompt)) {
      handleCommand(prompt, runtime);
      setInput("");
      return;
    }

    const preflightIssue = getChatPreflightIssue(runtime.config, session, agentMode);
    if (preflightIssue) {
      setNotice(preflightIssue.notice);
      if (preflightIssue.modal) setActiveModal(preflightIssue.modal);
      runtime.sessions.addMessage(session.id, {
        role: "assistant",
        source: "ui",
        content: preflightIssue.message,
      });
      setMessages([...session.messages]);
      return;
    }

    if (runtime.config.tui.showInputPreview && !showInputPreview) {
      setPendingInput(prompt);
      setShowInputPreview(true);
      return;
    }

    void runAgent(runtime, session, prompt, agentMode);
  }

  function handleCommand(command: string, activeRuntime: DeepCodeRuntime): void {
    const [name] = command.split(/\s+/, 1);
    if (name === "/help") {
      setViewMode("help"); setVimMode("normal"); setNotice(t("helpOpened")); return;
    }
    if (name === "/clear") {
      setMessages([]); setNotice(t("screenCleared")); return;
    }
    if (name === "/new") {
      const newSession = createNewSession(activeRuntime, agentMode);
      setApprovals([]); setNotice(t("newSession", { id: newSession.id })); return;
    }
    if (name === "/sessions") {
      useAgentStore.getState().setSelectedSessionIndex(0);
      setViewMode("sessions"); setVimMode("normal");
      setNotice(t("selectSessionEscapeToReturn")); return;
    }
    if (name === "/config") {
      resetEditor(); setViewMode("config"); setVimMode("normal");
      setNotice(t("configNavigateEdit")); return;
    }
    if (name === "/provider" || name === "/providers") {
      setActiveModal("provider"); setNotice(t("providerModalOpened")); return;
    }
    if (name === "/model" || name === "/models") {
      setActiveModal("model");
      setNotice(t("modelSelectorOpenedEscapeToClose", { mode: agentMode.toUpperCase() })); return;
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
      setNotice(t("modeUsage")); return;
    }
    if (name === "/github-login" || command.startsWith("/github login")) {
      void startGithubLogin(command, activeRuntime, session);
      return;
    }
    if (name === "/undo") {
      if (!activeRuntime || !session) { setNotice(t("undoNotAvailable")); return; }
      void activeRuntime.agent.undo(session.id).then((result) => {
        if (!result) {
          setNotice(t("undoNotAvailable"));
        } else {
          const worktree = session.worktree ?? "";
          const rel = result.path.startsWith(worktree)
            ? result.path.slice(worktree.length + 1)
            : result.path;
          setNotice(t("undoSuccess", { path: rel }));
        }
      });
      return;
    }
    if (name === "/diff") {
      setDetailContent("diff");
      useUIStore.getState().openPanel("detail");
      setNotice(t("slashDiffDesc"));
      return;
    }
    if (name === "/timeline") {
      setDetailContent("timeline");
      useUIStore.getState().openPanel("detail");
      setNotice(t("slashTimelineDesc"));
      return;
    }
    setNotice(t("unknownCommand", { command }));
  }

  // ── Telemetry export ───────────────────────────────────────────────────────
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

  // ── Input preview callbacks ────────────────────────────────────────────────
  function handleConfirmInput(): void {
    if (!runtime || !session) return;
    setShowInputPreview(false);
    void runAgent(runtime, session, pendingInput.trim(), agentMode);
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

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.error} bold>{t("appDeepCodeError")}</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!runtime || !session) {
    return <Text>{t("loadingDeepCode")}</Text>;
  }

  const activeApproval = approvals[0];
  const hasParallelTasks = Object.keys(taskBuffers).length > 1;

  const approvalHasDiff = Boolean(activeApproval?.diff);

  // Build the detail panel content based on detailContent state
  const detailPanelContent = detailContent === "timeline" ? (
    <SessionTimeline
      activities={activities}
      theme={theme}
      isActive={detailContent === "timeline" && !activeModal}
      onClose={() => {
        setDetailContent("none");
        useUIStore.getState().closePanel("detail");
      }}
    />
  ) : detailContent === "config" && runtime ? (
    <ConfigPanel
      runtime={runtime}
      theme={theme}
      isActive={detailContent === "config" && !activeModal}
      onClose={() => {
        setDetailContent("none");
        useUIStore.getState().closePanel("detail");
      }}
      onSave={async (fieldKey, value) => {
        const field = CONFIG_FIELDS.find((f) => f.key === fieldKey);
        if (field) await saveConfigEdit(runtime, field, value);
      }}
    />
  ) : (
    <Box paddingX={1} paddingY={1}>
      <Text color={theme.fgMuted} dimColor>{t("detailPanelPlaceholder")}</Text>
    </Box>
  );

  return (
    <AppLayout
      height={stdout.rows}
      theme={theme}
      header={
        <Header
          provider={activeModeSelection?.provider ?? activeProviderId}
          model={activeModeSelection?.model || t("notConfigured")}
          agentMode={agentMode}
          theme={theme}
          providerStatus={activeProviderStatus}
        />
      }
      contextPanel={
        contextView === "files" ? (
          <FileTreePanel files={fileTree} theme={theme} cwd={props.cwd} />
        ) : (
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
            onApprovalAction={(requestId, allowed, scope) => {
              resolveApproval(
                runtime,
                approvals.find((a) => a.id === requestId),
                allowed,
                scope,
                { setNotice, setStatus },
              );
            }}
            telemetryStats={telemetry.stats}
            telemetryBreakdown={telemetry.toolBreakdown}
            currentPlan={currentPlan}
            hotkeysEnabled={sidebarHotkeysEnabled}
          />
        )
      }
      detailPanel={detailPanelContent}
      executionPanel={
        <Box flexDirection="column" flexGrow={1}>
          {activeModal === "provider" && (
            <ErrorBoundary theme={theme} onReset={() => setActiveModal(null)}>
              <ProviderModal
                theme={theme}
                currentProvider={activeProviderId}
                providers={Object.entries(runtime.config.providers).map(([id, provider]) => ({
                  id: id as ProviderId,
                  name: PROVIDER_LABELS[id as ProviderId] ?? id,
                  status: statuses[id as ProviderId] ?? EMPTY_PROVIDER_STATUS,
                  hasApiKey: Boolean(provider.apiKey),
                  hasApiKeyFile: Boolean(provider.apiKeyFile),
                  expectedTarget: session
                    ? formatExpectedProviderTarget(runtime.config, session, id as ProviderId, agentMode)
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
                      if (providerDefault) modeOverride.model = providerDefault;
                      else delete modeOverride.model;
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
                      setNotice(t("providerForModeActiveChooseModel", { mode: agentMode.toUpperCase(), provider: providerId }));
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
                      const prov = (providers[providerId] ?? {}) as Record<string, unknown>;
                      prov.apiKey = apiKey;
                      providers[providerId] = prov;
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
                      const prov = (providers[providerId] ?? {}) as Record<string, unknown>;
                      prov.apiKeyFile = apiKeyFile;
                      delete prov.apiKey;
                      providers[providerId] = prov;
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
                currentProvider={activeProviderId}
                recentSelections={recentModels}
                onSelect={(selection) => {
                  void (async () => {
                    try {
                      await saveConfigPatch(runtime, (mutable) => {
                        const defaults = ((mutable.defaultModels ?? {}) as Record<string, unknown>);
                        defaults[selection.provider] = selection.model;
                        mutable.defaultModels = defaults;
                        const modeDefaults = ((mutable.modeDefaults ?? {}) as Record<string, unknown>);
                        modeDefaults[agentMode] = { provider: selection.provider, model: selection.model };
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

          {githubOAuth.status !== "idle" && (
            <OAuthWizard state={githubOAuth} theme={theme} />
          )}

          {!activeModal && activeApproval && approvalHasDiff && previewState.open && (
            <PreviewOverlay
              summary={previewState.summary}
              files={previewState.files}
              selectedIndex={previewState.selectedIndex}
              theme={theme}
              isActive={!activeModal}
              onConfirm={() => {
                closePreview();
                resolveApproval(runtime, activeApproval, true, "once", { setNotice, setStatus });
              }}
              onCancel={() => {
                closePreview();
                resolveApproval(runtime, activeApproval, false, "once", { setNotice, setStatus });
              }}
              onNext={nextFile}
              onPrev={prevFile}
            />
          )}

          {!activeModal && activeApproval && !approvalHasDiff && (
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
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              {showHistorySearch && (
                <HistorySearch
                  history={useAgentStore.getState().history}
                  theme={theme}
                  isActive={showHistorySearch}
                  onSelect={(entry) => setInput(entry)}
                  onClose={() => setShowHistorySearch(false)}
                />
              )}

              {hasParallelTasks && (
                <ParallelTasksPanel
                  taskBuffers={taskBuffers}
                  streaming={streaming}
                  theme={theme}
                />
              )}

              {executionTasks.length > 0 && (
                <TaskProgress tasks={executionTasks} theme={theme} />
              )}

              {currentPlan && streaming && (
                <ProgressMatrix plan={currentPlan} theme={theme} />
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
                    <MessageList
                      messages={visibleMessages}
                      assistantDraft={assistantDraft}
                      streaming={streaming}
                      runtime={runtime}
                      theme={theme}
                      vimMode={vimMode}
                    />
                    {approvals.length > 0 && activeApproval && (
                      <ChatApprovalIndicator request={activeApproval} theme={theme} />
                    )}
                  </>
                )}
              </Box>

              {showSlashMenu && (
                <SlashCommandMenu
                  commands={slashCommandSuggestions}
                  selectedIndex={selectedSlashCommandIndex}
                  theme={theme}
                />
              )}

              {!showSlashMenu && !showHistorySearch && autocompleteSuggestions.length > 0 && (
                <CommandSuggestions
                  commands={[]}
                  fileSuggestions={autocompleteSuggestions}
                  selectedIndex={0}
                  theme={theme}
                />
              )}

              <InputField
                value={input}
                onChange={setInput}
                onSubmit={(v) => void handleSubmit(v)}
                vimMode={vimMode}
                streaming={streaming}
                focused={viewMode === "chat" && !activeModal && !showInputPreview}
                theme={theme}
              />
            </Box>
          )}
        </Box>
      }
      statusBar={
        <StatusBar
          theme={theme}
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
          gitBranch={gitStatus.branch}
          gitDirty={gitStatus.isDirty}
        />
      }
    />
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
