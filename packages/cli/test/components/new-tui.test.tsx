import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { TaskPlan } from "@deepcode/core";
import { useAgentStore, type TaskStreamBuffer } from "../../src/tui/store/agent-store.js";
import { TaskLane } from "../../src/tui/components/tasks/TaskLane.js";
import { ProgressMatrix } from "../../src/tui/components/tasks/ProgressMatrix.js";
import { ParallelTasksPanel } from "../../src/tui/components/tasks/ParallelTasksPanel.js";

const theme = {
  bg: "black", bgSecondary: "black", bgTertiary: "black",
  fg: "white", fgMuted: "gray", border: "gray", borderActive: "cyan",
  primary: "cyan", secondary: "green", success: "green",
  warning: "yellow", error: "red", accent: "magenta",
  userMsg: "cyan", assistantMsg: "green", toolMsg: "gray", systemMsg: "gray",
  selectionBg: "blue", selectionFg: "white",
} as const;

const makeBuffer = (overrides: Partial<TaskStreamBuffer> = {}): TaskStreamBuffer => ({
  taskId: "task-1",
  description: "Implement feature X",
  type: "code",
  status: "running",
  chunks: ["Writing file...", "\nDone."],
  attempt: 0,
  startedAt: Date.now() - 3000,
  ...overrides,
});

const makePlan = (tasks: Partial<{ id: string; type: string; status: string; description: string }[]> = []): TaskPlan => ({
  objective: "Build parallel execution",
  tasks: tasks.map((t, i) => ({
    id: t?.id ?? `task-${i + 1}`,
    type: (t?.type ?? "code") as "code" | "research" | "test" | "verify",
    status: (t?.status ?? "pending") as "pending" | "running" | "completed" | "failed",
    description: t?.description ?? `Task ${i + 1}`,
    dependencies: [],
    result: undefined,
    error: undefined,
  })),
  raw: undefined,
  currentTaskId: undefined,
});

describe("TaskLane", () => {
  it("renders running task with type badge and elapsed time", () => {
    const { lastFrame } = render(
      <TaskLane buffer={makeBuffer()} width={40} theme={theme} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("code");
    expect(frame).toContain("Implement feature X");
    expect(frame).toContain("▶");
  });

  it("renders completed task with success icon", () => {
    const { lastFrame } = render(
      <TaskLane buffer={makeBuffer({ status: "completed" })} width={40} theme={theme} />,
    );
    expect(lastFrame()).toContain("✓");
  });

  it("renders failed task with error icon and message", () => {
    const buf = makeBuffer({ status: "failed", error: "File not found" });
    const { lastFrame } = render(<TaskLane buffer={buf} width={40} theme={theme} />);
    const frame = lastFrame();
    expect(frame).toContain("✗");
    expect(frame).toContain("File not found");
  });

  it("shows retry badge when attempt > 0", () => {
    const { lastFrame } = render(
      <TaskLane buffer={makeBuffer({ attempt: 2 })} width={40} theme={theme} />,
    );
    expect(lastFrame()).toContain("⟳2");
  });

  it("shows streaming chunks output", () => {
    const buf = makeBuffer({ chunks: ["Analyzing code...", " refactoring..."] });
    const { lastFrame } = render(<TaskLane buffer={buf} width={50} theme={theme} />);
    expect(lastFrame()).toContain("Analyzing code");
  });
});

describe("ProgressMatrix", () => {
  it("renders plan objective", () => {
    const plan = makePlan([
      { id: "t1", type: "research", status: "completed", description: "Research" },
      { id: "t2", type: "code", status: "running", description: "Code" },
      { id: "t3", type: "test", status: "pending", description: "Test" },
    ]);
    const { lastFrame } = render(<ProgressMatrix plan={plan} theme={theme} />);
    const frame = lastFrame();
    expect(frame).toContain("Build parallel execution");
    expect(frame).toContain("✓");
    expect(frame).toContain("▶");
    expect(frame).toContain("○");
    expect(frame).toContain("1/3");
  });

  it("shows failed tasks count", () => {
    const plan = makePlan([
      { id: "t1", status: "failed", description: "Failed task" },
      { id: "t2", status: "completed", description: "OK task" },
    ]);
    const { lastFrame } = render(<ProgressMatrix plan={plan} theme={theme} />);
    expect(lastFrame()).toContain("1 failed");
  });
});

describe("ParallelTasksPanel", () => {
  it("renders nothing when not streaming", () => {
    const buffers = {
      "task-1": makeBuffer(),
      "task-2": makeBuffer({ taskId: "task-2", description: "Task 2" }),
    };
    const { lastFrame } = render(
      <ParallelTasksPanel taskBuffers={buffers} streaming={false} theme={theme} />,
    );
    expect(lastFrame()).toBe("");
  });

  it("renders task lanes when streaming with multiple tasks", () => {
    const buffers = {
      "task-1": makeBuffer({ taskId: "task-1", description: "Research phase" }),
      "task-2": makeBuffer({ taskId: "task-2", description: "Code phase", type: "research" }),
    };
    const { lastFrame } = render(
      <ParallelTasksPanel taskBuffers={buffers} streaming={true} theme={theme} />,
    );
    const frame = lastFrame();
    expect(frame).toContain("Research phase");
    expect(frame).toContain("Code phase");
  });
});

describe("agent-store", () => {
  beforeEach(() => {
    useAgentStore.setState({
      streaming: false,
      assistantDraft: "",
      taskBuffers: {},
      activities: [],
    });
  });

  it("STREAM_START clears draft and task buffers", () => {
    useAgentStore.setState({
      assistantDraft: "previous draft",
      taskBuffers: { "old-task": makeBuffer() },
    });
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    const state = useAgentStore.getState();
    expect(state.streaming).toBe(true);
    expect(state.assistantDraft).toBe("");
    expect(Object.keys(state.taskBuffers)).toHaveLength(0);
  });

  it("CHUNK with null taskId appends to assistantDraft", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({ type: "CHUNK", taskId: null, text: "Hello " });
    useAgentStore.getState().dispatch({ type: "CHUNK", taskId: null, text: "world" });
    expect(useAgentStore.getState().assistantDraft).toBe("Hello world");
  });

  it("TASK_START creates buffer with running status", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({
      type: "TASK_START",
      taskId: "task-abc",
      description: "Write tests",
      taskType: "test",
      attempt: 0,
    });
    const buf = useAgentStore.getState().taskBuffers["task-abc"];
    expect(buf).toBeDefined();
    expect(buf?.status).toBe("running");
    expect(buf?.type).toBe("test");
    expect(buf?.description).toBe("Write tests");
  });

  it("CHUNK with taskId appends to that buffer only", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({
      type: "TASK_START", taskId: "t1", description: "T1", taskType: "code", attempt: 0,
    });
    useAgentStore.getState().dispatch({
      type: "TASK_START", taskId: "t2", description: "T2", taskType: "research", attempt: 0,
    });
    useAgentStore.getState().dispatch({ type: "CHUNK", taskId: "t1", text: "chunk-A" });
    useAgentStore.getState().dispatch({ type: "CHUNK", taskId: "t2", text: "chunk-B" });

    const state = useAgentStore.getState();
    expect(state.taskBuffers["t1"]?.chunks).toContain("chunk-A");
    expect(state.taskBuffers["t2"]?.chunks).toContain("chunk-B");
    expect(state.taskBuffers["t1"]?.chunks).not.toContain("chunk-B");
    expect(state.assistantDraft).toBe(""); // not contaminated
  });

  it("TASK_COMPLETE marks buffer as completed", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({
      type: "TASK_START", taskId: "t1", description: "T1", taskType: "code", attempt: 0,
    });
    useAgentStore.getState().dispatch({ type: "TASK_COMPLETE", taskId: "t1" });
    expect(useAgentStore.getState().taskBuffers["t1"]?.status).toBe("completed");
  });

  it("TASK_FAIL with willRetry=false marks buffer as failed", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({
      type: "TASK_START", taskId: "t1", description: "T1", taskType: "verify", attempt: 0,
    });
    useAgentStore.getState().dispatch({
      type: "TASK_FAIL", taskId: "t1", error: "timed out", willRetry: false,
    });
    const buf = useAgentStore.getState().taskBuffers["t1"];
    expect(buf?.status).toBe("failed");
    expect(buf?.error).toBe("timed out");
  });

  it("ACTIVITY keeps last 100 entries", () => {
    const base = { id: "x", type: "tool" as const, description: "", metadata: {}, timestamp: new Date().toISOString() };
    for (let i = 0; i < 110; i++) {
      useAgentStore.getState().dispatch({ type: "ACTIVITY", activity: { ...base, id: `a${i}` } });
    }
    expect(useAgentStore.getState().activities).toHaveLength(100);
  });

  it("STREAM_END clears streaming and draft", () => {
    useAgentStore.getState().dispatch({ type: "STREAM_START" });
    useAgentStore.getState().dispatch({ type: "CHUNK", taskId: null, text: "some text" });
    useAgentStore.getState().dispatch({ type: "STREAM_END" });
    const state = useAgentStore.getState();
    expect(state.streaming).toBe(false);
    expect(state.assistantDraft).toBe("");
  });
});
