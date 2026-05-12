import { useCallback, type MutableRefObject } from "react";
import type { Session, AgentMode, Activity } from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import { TelemetryCollector, type TaskPlan } from "@deepcode/core";
import { extractTaskPlanFromSession, resolveLaunchSessionTarget } from "../app-utils.js";
import type { ViewMode, VimMode } from "../types.js";

interface SessionUpdateExtras {
  messages?: Session["messages"];
  activities?: Activity[];
  toolCalls?: Array<{ id: string; name: string; args: string; result?: string }>;
  status?: string;
  currentPlan?: TaskPlan | undefined;
  viewMode?: ViewMode;
  vimMode?: VimMode;
  assistantDraft?: string;
}

interface UseSessionManagerOptions {
  telemetryRef: MutableRefObject<TelemetryCollector | null>;
  activeSessionIdRef: MutableRefObject<string | null>;
  onUpdateSession: (session: Session, extras?: SessionUpdateExtras) => void;
}

export function useSessionManager({
  telemetryRef,
  activeSessionIdRef,
  onUpdateSession,
}: UseSessionManagerOptions) {
  const activateTelemetrySession = useCallback((
    targetSession: Pick<Session, "id" | "provider" | "model">,
    finalizePrevious = true,
  ) => {
    const previousSessionId = activeSessionIdRef.current;
    activeSessionIdRef.current = targetSession.id;

    const collector = telemetryRef.current;
    if (!collector) return;

    if (finalizePrevious && previousSessionId && previousSessionId !== targetSession.id) {
      void collector.finalizeSession(previousSessionId);
    }

    void collector.createSession(targetSession.id, targetSession.provider, targetSession.model || "unknown");
  }, [activeSessionIdRef, telemetryRef]);

  const createNewSession = useCallback((
    activeRuntime: DeepCodeRuntime,
    agentMode: AgentMode,
  ): Session => {
    const next = activeRuntime.sessions.create(resolveLaunchSessionTarget(activeRuntime.config, agentMode));
    activateTelemetrySession(next);
    activeRuntime.permissions.clearSessionAllowSet();
    onUpdateSession(next, {
      messages: [],
      activities: [],
      toolCalls: [],
      status: next.status,
      currentPlan: extractTaskPlanFromSession(next),
      viewMode: "chat",
      vimMode: "insert",
    });
    return next;
  }, [activateTelemetrySession, onUpdateSession]);

  const switchSession = useCallback((
    next: Session,
    activeRuntime: DeepCodeRuntime,
  ) => {
    activateTelemetrySession(next);
    activeRuntime.permissions.clearSessionAllowSet();
    onUpdateSession(next, {
      messages: next.messages,
      activities: next.activities.slice(-10),
      toolCalls: [],
      status: next.status,
      currentPlan: extractTaskPlanFromSession(next),
      viewMode: "chat",
      vimMode: "insert",
      assistantDraft: "",
    });
  }, [activateTelemetrySession, onUpdateSession]);

  return {
    activateTelemetrySession,
    createNewSession,
    switchSession,
  };
}
