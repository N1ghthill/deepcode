import { create } from "zustand";

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface ExecutionTask {
  id: string;
  description: string;
  type: "research" | "code" | "test" | "verify" | "tool" | "plan";
  status: TaskStatus;
  model?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  result?: string;
}

export interface ExecutionStoreState {
  tasks: ExecutionTask[];
  activeTaskId: string | null;

  addTask: (task: ExecutionTask) => void;
  updateTask: (id: string, patch: Partial<ExecutionTask>) => void;
  completeTask: (id: string, result?: string) => void;
  failTask: (id: string, error: string) => void;
  clearTasks: () => void;
  setActiveTaskId: (id: string | null) => void;
}

export const useExecutionStore = create<ExecutionStoreState>()((set) => ({
  tasks: [],
  activeTaskId: null,

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  updateTask: (id, patch) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  completeTask: (id, result) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "completed", completedAt: Date.now(), durationMs: t.startedAt ? Date.now() - t.startedAt : undefined, result }
          : t,
      ),
    })),

  failTask: (id, error) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: "failed", completedAt: Date.now(), error } : t,
      ),
    })),

  clearTasks: () => set({ tasks: [], activeTaskId: null }),

  setActiveTaskId: (id) => set({ activeTaskId: id }),
}));
