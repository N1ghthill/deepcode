import React from "react";
import { useInput } from "ink";
import type { ApprovalRequest } from "@deepcode/core";
import type { AgentMode, Session } from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import { formatModelSelection } from "../model-selection.js";
import { resolveEffectiveModeSelection } from "../mode-routing.js";
import type { DetailContent, ModalType, ViewMode, VimMode } from "../types.js";
import { t } from "../i18n/index.js";
import { useUIStore } from "../store/ui-store.js";
import { useAgentStore } from "../store/agent-store.js";

interface UseGlobalAppInputOptions {
  saveUIState: () => void;
  abortRef: React.RefObject<AbortController | null>;
  githubOAuthAbortRef: React.RefObject<AbortController | null>;
  exit: () => void;
  githubOAuthStatus: string;
  cancelOAuth: () => void;
  startGithubLogin: (command: string, runtime: DeepCodeRuntime, session: Session) => Promise<void>;
  streaming: boolean;
  setStatus: (status: string) => void;
  setNotice: (notice: string) => void;
  runtime: DeepCodeRuntime | null;
  session: Session | null;
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  approvals: ApprovalRequest[];
  resolveApproval: (
    runtime: DeepCodeRuntime,
    request: ApprovalRequest | undefined,
    allowed: boolean,
    scope: "once" | "session" | "always",
    handlers: { setNotice: (notice: string) => void; setStatus: (status: string) => void },
  ) => void;
  showInputPreview: boolean;
  setShowInputPreview: (show: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setVimMode: (mode: VimMode) => void;
  input: string;
  vimMode: VimMode;
  showSlashMenu: boolean;
  agentMode: AgentMode;
  setAgentMode: React.Dispatch<React.SetStateAction<AgentMode>>;
  detailContent: DetailContent;
  setDetailContent: (content: DetailContent) => void;
  setContextView: React.Dispatch<React.SetStateAction<"sidebar" | "files">>;
  createNewSession: (runtime: DeepCodeRuntime, agentMode: AgentMode) => Session;
  setApprovals: React.Dispatch<React.SetStateAction<ApprovalRequest[]>>;
  showHistorySearch: boolean;
  setShowHistorySearch: (show: boolean) => void;
}

export function useGlobalAppInput(options: UseGlobalAppInputOptions): void {
  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "q") {
      options.saveUIState();
      options.abortRef.current?.abort();
      options.githubOAuthAbortRef.current?.abort();
      options.exit();
      return;
    }
    if (key.ctrl && inputChar === "c") {
      if (options.githubOAuthStatus !== "idle") {
        options.cancelOAuth();
      } else if (options.streaming) {
        options.abortRef.current?.abort();
        options.setStatus("cancelled");
        options.setNotice(t("executionCancelled"));
      } else {
        options.exit();
      }
      return;
    }

    if (!options.runtime || !options.session) return;

    if (options.githubOAuthAbortRef.current || options.githubOAuthStatus === "waiting") {
      if (key.escape) {
        options.cancelOAuth();
        return;
      }
      if (inputChar?.toLowerCase() === "r") {
        void options.startGithubLogin("/github-login", options.runtime, options.session);
        return;
      }
      return;
    }

    if (options.activeModal) {
      if (key.escape) {
        options.setActiveModal(null);
        options.setNotice(t("modalClosed"));
      }
      return;
    }

    if (options.approvals.length > 0) {
      if (inputChar?.toLowerCase() === "a") {
        options.resolveApproval(options.runtime, options.approvals[0], true, "once", options);
        return;
      }
      if (inputChar?.toLowerCase() === "l") {
        options.resolveApproval(options.runtime, options.approvals[0], true, "always", options);
        return;
      }
      if (inputChar?.toLowerCase() === "s") {
        options.resolveApproval(options.runtime, options.approvals[0], true, "session", options);
        return;
      }
      if (inputChar?.toLowerCase() === "d" || inputChar?.toLowerCase() === "n" || key.escape) {
        options.resolveApproval(options.runtime, options.approvals[0], false, "once", options);
        return;
      }
      return;
    }

    if (options.showInputPreview) {
      if (key.escape || key.return) {
        options.setShowInputPreview(false);
      }
      return;
    }

    if (options.viewMode === "help") {
      if (key.escape || key.return || inputChar?.toLowerCase() === "q") {
        options.setViewMode("chat");
        options.setVimMode("insert");
        options.setNotice(t("chatActive"));
      }
      return;
    }

    if (key.ctrl && inputChar === "h") {
      options.setViewMode("help");
      options.setVimMode("normal");
      options.setNotice(t("helpOpenedEscapeToReturn"));
      return;
    }
    if (key.ctrl && inputChar === "o") {
      useAgentStore.getState().setSelectedSessionIndex(0);
      options.setViewMode("sessions");
      options.setVimMode("normal");
      options.setNotice(t("selectSessionEscapeToReturn"));
      return;
    }
    if (key.ctrl && inputChar === "n") {
      const newSession = options.createNewSession(options.runtime, options.agentMode);
      options.setApprovals([]);
      options.setNotice(t("newSession", { id: newSession.id }));
      return;
    }
    if (key.ctrl && inputChar === "p") {
      options.setActiveModal("provider");
      options.setNotice(t("providerModalOpenedEscapeToClose"));
      return;
    }
    if (key.ctrl && inputChar === "m") {
      options.setActiveModal("model");
      options.setNotice(t("modelSelectorOpenedEscapeToClose", { mode: options.agentMode.toUpperCase() }));
      return;
    }
    if (key.ctrl && inputChar === "t") {
      options.setActiveModal("telemetry");
      options.setNotice(t("appTelemetryPanelOpened"));
      return;
    }
    if (key.ctrl && inputChar === "b") {
      useUIStore.getState().togglePanel("context");
      return;
    }
    if (key.ctrl && inputChar === "f") {
      options.setContextView((value) => (value === "sidebar" ? "files" : "sidebar"));
      useUIStore.getState().openPanel("context");
      return;
    }
    if (key.ctrl && inputChar === ",") {
      const nextDetail: DetailContent = options.detailContent === "config" ? "none" : "config";
      options.setDetailContent(nextDetail);
      if (nextDetail !== "none") {
        useUIStore.getState().openPanel("detail");
      } else {
        useUIStore.getState().closePanel("detail");
      }
      return;
    }
    if (key.ctrl && inputChar === "r" && !options.streaming && options.vimMode === "insert") {
      options.setShowHistorySearch(true);
      return;
    }
    if (key.ctrl && inputChar === "l") {
      const nextDetail: DetailContent = options.detailContent === "timeline" ? "none" : "timeline";
      options.setDetailContent(nextDetail);
      if (nextDetail !== "none") {
        useUIStore.getState().openPanel("detail");
      } else {
        useUIStore.getState().closePanel("detail");
      }
      return;
    }
    if (options.showHistorySearch && key.escape) {
      options.setShowHistorySearch(false);
      return;
    }

    if (key.tab && !key.ctrl && !options.showSlashMenu) {
      options.setAgentMode((current) => {
        const next: AgentMode = current === "build" ? "plan" : "build";
        const nextSelection = options.runtime && options.session
          ? resolveEffectiveModeSelection(options.runtime.config, options.session, next)
          : null;
        options.setNotice(
          nextSelection
            ? t("modeChangedWithModel", { mode: next.toUpperCase(), model: formatModelSelection(nextSelection) })
            : t("modeChanged", { mode: next.toUpperCase() }),
        );
        return next;
      });
    }
  });
}
