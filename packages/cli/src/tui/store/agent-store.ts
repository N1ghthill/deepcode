import { create } from "zustand";
import type { Activity, AgentMode, Message, Session } from "@deepcode/shared";
import type { TaskPlan } from "@deepcode/core";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { ViewMode, VimMode, ModalType, DetailContent } from "../types.js";
import type { SidebarTab } from "../components/layout/index.js";
import type { RecentModelSelection } from "../persistence/ui-state.js";

export interface TaskStreamBuffer {
  taskId: string;
  description: string;
  type: "research" | "code" | "test" | "verify";
  status: "pending" | "running" | "completed" | "failed";
  chunks: string[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
  attempt: number;
}

export type AgentAction =
  | { type: "CHUNK"; taskId: string | null; text: string }
  | { type: "TASK_START"; taskId: string; description: string; taskType: string; attempt: number }
  | { type: "TASK_COMPLETE"; taskId: string }
  | { type: "TASK_FAIL"; taskId: string; error: string; willRetry: boolean }
  | { type: "PLAN_UPDATE"; plan: TaskPlan }
  | { type: "ACTIVITY"; activity: Activity }
  | { type: "STREAM_START" }
  | { type: "STREAM_END" };

export interface AgentStoreState {
  // Runtime
  runtime: DeepCodeRuntime | null;
  session: Session | null;

  // Chat
  input: string;
  messages: Message[];
  activities: Activity[];
  streaming: boolean;
  assistantDraft: string;
  status: string;
  notice: string;
  error: string | null;

  // UI navigation
  viewMode: ViewMode;
  selectedSessionIndex: number;
  history: string[];
  historyIndex: number | null;
  vimMode: VimMode;
  cursorOffset: number;
  sidebarTab: SidebarTab;
  sidebarVisible: boolean;
  activeModal: ModalType;
  agentMode: AgentMode;
  showInputPreview: boolean;
  pendingInput: string;
  selectedSlashCommandIndex: number;
  slashMenuDismissed: boolean;

  // Task execution
  currentPlan: TaskPlan | undefined;
  taskBuffers: Record<string, TaskStreamBuffer>;
  toolCalls: Array<{ id: string; name: string; args: string; result?: string }>;
  toolExecuting: boolean;
  phase: string;
  iteration: { current: number; max: number };

  // Telemetry
  recentModels: RecentModelSelection[];
  telemetryExportStatus: "idle" | "exporting" | "success" | "error";
  lastExportPath: string | null;

  // New panel state
  showHistorySearch: boolean;
  detailContent: DetailContent;

  // Setters for UI state
  setRuntime: (r: DeepCodeRuntime | null) => void;
  setSession: (s: Session | null) => void;
  setInput: (i: string | ((prev: string) => string)) => void;
  setMessages: (m: Message[] | ((prev: Message[]) => Message[])) => void;
  setActivities: (a: Activity[] | ((prev: Activity[]) => Activity[])) => void;
  setStreaming: (s: boolean) => void;
  setAssistantDraft: (d: string | ((prev: string) => string)) => void;
  setStatus: (s: string) => void;
  setNotice: (n: string) => void;
  setError: (e: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  setSelectedSessionIndex: (i: number | ((prev: number) => number)) => void;
  setHistory: (h: string[] | ((prev: string[]) => string[])) => void;
  setHistoryIndex: (i: number | null) => void;
  setVimMode: (v: VimMode) => void;
  setCursorOffset: (n: number) => void;
  setSidebarTab: (t: SidebarTab) => void;
  setSidebarVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  setActiveModal: (m: ModalType) => void;
  setAgentMode: (m: AgentMode | ((prev: AgentMode) => AgentMode)) => void;
  setShowInputPreview: (s: boolean) => void;
  setPendingInput: (p: string) => void;
  setSelectedSlashCommandIndex: (i: number) => void;
  setSlashMenuDismissed: (v: boolean) => void;
  setCurrentPlan: (p: TaskPlan | undefined) => void;
  setToolCalls: (t: Array<{ id: string; name: string; args: string; result?: string }> | ((prev: Array<{ id: string; name: string; args: string; result?: string }>) => Array<{ id: string; name: string; args: string; result?: string }>)) => void;
  setToolExecuting: (e: boolean) => void;
  setPhase: (p: string) => void;
  setIteration: (i: { current: number; max: number }) => void;
  setRecentModels: (m: RecentModelSelection[] | ((prev: RecentModelSelection[]) => RecentModelSelection[])) => void;
  setTelemetryExportStatus: (s: "idle" | "exporting" | "success" | "error") => void;
  setLastExportPath: (p: string | null) => void;
  setShowHistorySearch: (v: boolean) => void;
  setDetailContent: (v: DetailContent) => void;

  // Compound action dispatcher for agent callbacks
  dispatch: (action: AgentAction) => void;
}

function resolveUpdater<T>(valueOrUpdater: T | ((prev: T) => T), prev: T): T {
  return typeof valueOrUpdater === "function"
    ? (valueOrUpdater as (prev: T) => T)(prev)
    : valueOrUpdater;
}

export const useAgentStore = create<AgentStoreState>()((set) => ({
  runtime: null,
  session: null,
  input: "",
  messages: [],
  activities: [],
  streaming: false,
  assistantDraft: "",
  status: "loading",
  notice: "",
  error: null,
  viewMode: "chat",
  selectedSessionIndex: 0,
  history: [],
  historyIndex: null,
  vimMode: "insert",
  cursorOffset: 0,
  sidebarTab: "sessions",
  sidebarVisible: false,
  activeModal: null,
  agentMode: "build",
  showInputPreview: false,
  pendingInput: "",
  selectedSlashCommandIndex: 0,
  slashMenuDismissed: false,
  currentPlan: undefined,
  taskBuffers: {},
  toolCalls: [],
  toolExecuting: false,
  phase: "",
  iteration: { current: 0, max: 0 },
  recentModels: [],
  telemetryExportStatus: "idle",
  lastExportPath: null,
  showHistorySearch: false,
  detailContent: "none",

  setRuntime: (r) => set({ runtime: r }),
  setSession: (s) => set({ session: s }),
  setInput: (i) => set((state) => ({ input: resolveUpdater(i, state.input) })),
  setMessages: (m) => set((state) => ({ messages: resolveUpdater(m, state.messages) })),
  setActivities: (a) => set((state) => ({ activities: resolveUpdater(a, state.activities) })),
  setStreaming: (s) => set({ streaming: s }),
  setAssistantDraft: (d) => set((state) => ({ assistantDraft: resolveUpdater(d, state.assistantDraft) })),
  setStatus: (s) => set({ status: s }),
  setNotice: (n) => set({ notice: n }),
  setError: (e) => set({ error: e }),
  setViewMode: (v) => set({ viewMode: v }),
  setSelectedSessionIndex: (i) => set((state) => ({ selectedSessionIndex: resolveUpdater(i, state.selectedSessionIndex) })),
  setHistory: (h) => set((state) => ({ history: resolveUpdater(h, state.history) })),
  setHistoryIndex: (i) => set({ historyIndex: i }),
  setVimMode: (v) => set({ vimMode: v }),
  setCursorOffset: (n) => set({ cursorOffset: n }),
  setSidebarTab: (t) => set({ sidebarTab: t }),
  setSidebarVisible: (v) => set((state) => ({ sidebarVisible: resolveUpdater(v, state.sidebarVisible) })),
  setActiveModal: (m) => set({ activeModal: m }),
  setAgentMode: (m) => set((state) => ({ agentMode: resolveUpdater(m, state.agentMode) })),
  setShowInputPreview: (s) => set({ showInputPreview: s }),
  setPendingInput: (p) => set({ pendingInput: p }),
  setSelectedSlashCommandIndex: (i) => set({ selectedSlashCommandIndex: i }),
  setSlashMenuDismissed: (v) => set({ slashMenuDismissed: v }),
  setCurrentPlan: (p) => set({ currentPlan: p }),
  setToolCalls: (t) => set((state) => ({ toolCalls: resolveUpdater(t, state.toolCalls) })),
  setToolExecuting: (e) => set({ toolExecuting: e }),
  setPhase: (p) => set({ phase: p }),
  setIteration: (i) => set({ iteration: i }),
  setRecentModels: (m) => set((state) => ({ recentModels: resolveUpdater(m, state.recentModels) })),
  setTelemetryExportStatus: (s) => set({ telemetryExportStatus: s }),
  setLastExportPath: (p) => set({ lastExportPath: p }),
  setShowHistorySearch: (v) => set({ showHistorySearch: v }),
  setDetailContent: (v) => set({ detailContent: v }),

  dispatch: (action) =>
    set((state) => {
      switch (action.type) {
        case "STREAM_START":
          return { streaming: true, assistantDraft: "", taskBuffers: {} };

        case "STREAM_END":
          return { streaming: false, assistantDraft: "" };

        case "CHUNK": {
          if (action.taskId === null) {
            return { assistantDraft: state.assistantDraft + action.text };
          }
          const buf = state.taskBuffers[action.taskId];
          if (!buf) return state;
          return {
            taskBuffers: {
              ...state.taskBuffers,
              [action.taskId]: { ...buf, chunks: [...buf.chunks, action.text] },
            },
          };
        }

        case "TASK_START": {
          const existing = state.taskBuffers[action.taskId];
          return {
            taskBuffers: {
              ...state.taskBuffers,
              [action.taskId]: {
                taskId: action.taskId,
                description: action.description,
                type: action.taskType as TaskStreamBuffer["type"],
                status: "running",
                chunks: existing?.chunks ?? [],
                startedAt: Date.now(),
                attempt: action.attempt,
              },
            },
          };
        }

        case "TASK_COMPLETE": {
          const buf = state.taskBuffers[action.taskId];
          if (!buf) return state;
          return {
            taskBuffers: {
              ...state.taskBuffers,
              [action.taskId]: { ...buf, status: "completed", completedAt: Date.now() },
            },
          };
        }

        case "TASK_FAIL": {
          const buf = state.taskBuffers[action.taskId];
          if (!buf) return state;
          return {
            taskBuffers: {
              ...state.taskBuffers,
              [action.taskId]: {
                ...buf,
                status: action.willRetry ? "running" : "failed",
                error: action.error,
                attempt: buf.attempt + (action.willRetry ? 1 : 0),
              },
            },
          };
        }

        case "PLAN_UPDATE":
          return { currentPlan: action.plan };

        case "ACTIVITY":
          return {
            activities: [...state.activities.slice(-99), action.activity],
          };

        default:
          return state;
      }
    }),
}));
