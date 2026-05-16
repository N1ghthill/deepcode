import type React from "react";
import { useRef, useCallback } from "react";
import {
  collectSecretValues,
  redactText,
  TelemetryCollector,
  type TaskPlan,
} from "@deepcode/core";
import {
  type AgentMode,
  type ModelInfo,
  type Session,
} from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import { useAgentStore } from "../store/agent-store.js";
import { useExecutionStore, type ExecutionTask } from "../store/execution-store.js";
import { cloneTaskPlan, extractTaskPlanFromSession, getModelPricing, recordAgentRunError } from "../app-utils.js";
import { t } from "../i18n/index.js";

export interface AgentBridgeOptions {
  models: ModelInfo[];
  telemetryRef: React.MutableRefObject<TelemetryCollector | null>;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  abortRef: React.MutableRefObject<AbortController | null>;
  recordTokenUsage: (input: number, output: number, cost: number) => void;
  resetMetrics: () => void;
}

export function useAgentBridge(options: AgentBridgeOptions) {
  const {
    telemetryRef,
    abortRef,
    recordTokenUsage,
    resetMetrics,
  } = options;

  const modelsRef = useRef(options.models);
  modelsRef.current = options.models;

  const dispatch = useAgentStore((s) => s.dispatch);
  const agentMode = useAgentStore((s) => s.agentMode);
  const setMessages = useAgentStore((s) => s.setMessages);
  const setActivities = useAgentStore((s) => s.setActivities);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setCurrentPlan = useAgentStore((s) => s.setCurrentPlan);
  const setNotice = useAgentStore((s) => s.setNotice);
  const setInput = useAgentStore((s) => s.setInput);
  const setHistory = useAgentStore((s) => s.setHistory);
  const setHistoryIndex = useAgentStore((s) => s.setHistoryIndex);
  const setToolExecuting = useAgentStore((s) => s.setToolExecuting);
  const setPhase = useAgentStore((s) => s.setPhase);
  const setIteration = useAgentStore((s) => s.setIteration);
  const setToolCalls = useAgentStore((s) => s.setToolCalls);

  const runAgent = useCallback(
    async (
      activeRuntime: DeepCodeRuntime,
      activeSession: Session,
      prompt: string,
      mode: AgentMode,
    ): Promise<void> => {
      if (!prompt) return;

      setInput("");
      setHistory((current) => [...current, prompt].slice(-50));
      setHistoryIndex(null);
      dispatch({ type: "STREAM_START" });
      useExecutionStore.getState().clearTasks();
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

      const modelPricing = getModelPricing(modelsRef.current, activeSession.provider, activeSession.model || "");

      try {
        await activeRuntime.agent.run({
          session: activeSession,
          input: prompt,
          mode,
          signal: controller.signal,

          onChunk: (text) => {
            setToolExecuting(false);
            dispatch({
              type: "CHUNK",
              taskId: null,
              text: redactText(text, collectSecretValues(activeRuntime.config)),
            });
            setMessages([...activeSession.messages]);
          },

          onChunkForTask: (taskId, text) => {
            dispatch({
              type: "CHUNK",
              taskId,
              text: redactText(text, collectSecretValues(activeRuntime.config)),
            });
          },

          onUsage: (inputTokens, outputTokens) => {
            const cost =
              (inputTokens / 1000) * modelPricing.inputPer1k +
              (outputTokens / 1000) * modelPricing.outputPer1k;
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

          onTaskUpdate: (task, plan) => {
            const nextPlan: TaskPlan = cloneTaskPlan(plan);
            activeSession.metadata.plan = nextPlan;
            dispatch({ type: "PLAN_UPDATE", plan: nextPlan });

            const execStore = useExecutionStore.getState();
            if (task.status === "running") {
              dispatch({
                type: "TASK_START",
                taskId: task.id,
                description: task.description,
                taskType: task.type,
                attempt: 0,
              });
              const execTask: ExecutionTask = {
                id: task.id,
                description: task.description,
                type: (task.type as ExecutionTask["type"]) ?? "tool",
                status: "running",
                startedAt: Date.now(),
              };
              execStore.addTask(execTask);
            } else if (task.status === "completed") {
              dispatch({ type: "TASK_COMPLETE", taskId: task.id });
              execStore.completeTask(task.id);
            } else if (task.status === "failed") {
              dispatch({
                type: "TASK_FAIL",
                taskId: task.id,
                error: task.error ?? "unknown",
                willRetry: false,
              });
              execStore.failTask(task.id, task.error ?? "unknown");
            }

            const progress = plan.tasks.filter((t) => t.status === "completed").length;
            setPhase(`task ${progress + 1}/${plan.tasks.length}`);
            setIteration({ current: progress + 1, max: plan.tasks.length });
          },
        });

        setMessages([...activeSession.messages]);
        setActivities(activeSession.activities.slice(-100));
        setStatus(activeSession.status);
        setCurrentPlan(extractTaskPlanFromSession(activeSession));

        const planError = activeSession.metadata?.planError as string | undefined;
        if (planError) {
          setNotice(t("planningFailed", { error: planError }));
        } else {
          setNotice(t("taskCompleted"));
        }
      } catch (err) {
        const message = await recordAgentRunError(activeRuntime, activeSession, err);
        setMessages([...activeSession.messages]);
        setActivities(activeSession.activities.slice(-100));
        setStatus("error");
        setCurrentPlan(extractTaskPlanFromSession(activeSession));
        setNotice(t("error", { message }));
      } finally {
        dispatch({ type: "STREAM_END" });
        setToolExecuting(false);
        setPhase("");
        setIteration({ current: 0, max: 0 });
        abortRef.current = null;
      }
    },
    [
      dispatch,
      setMessages,
      setActivities,
      setStatus,
      setCurrentPlan,
      setNotice,
      setInput,
      setHistory,
      setHistoryIndex,
      setToolExecuting,
      setPhase,
      setIteration,
      setToolCalls,
      resetMetrics,
      abortRef,
      telemetryRef,
      recordTokenUsage,
    ],
  );

  // Exposed agentMode for consumers that need it inside callbacks
  const agentModeRef = useRef(agentMode);
  agentModeRef.current = agentMode;

  return { runAgent };
}
