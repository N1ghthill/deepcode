import type { Session } from "@deepcode/shared";
import type { TaskPlan } from "@deepcode/core";

export function extractTaskPlanFromSession(session: Session): TaskPlan | undefined {
  return isTaskPlan(session.metadata.plan) ? cloneTaskPlan(session.metadata.plan) : undefined;
}

export function cloneTaskPlan(plan: TaskPlan): TaskPlan {
  return {
    objective: plan.objective,
    raw: plan.raw,
    currentTaskId: plan.currentTaskId,
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      description: task.description,
      type: task.type,
      dependencies: [...task.dependencies],
      status: task.status,
      result: task.result,
      error: task.error,
    })),
  };
}

function isTaskPlan(value: unknown): value is TaskPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (typeof plan.objective !== "string" || !Array.isArray(plan.tasks)) return false;

  return plan.tasks.every((task) => isTask(task));
}

function isTask(value: unknown): value is TaskPlan["tasks"][number] {
  if (!value || typeof value !== "object") return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === "string" &&
    typeof task.description === "string" &&
    isTaskType(task.type) &&
    Array.isArray(task.dependencies) &&
    task.dependencies.every((dependency) => typeof dependency === "string") &&
    isTaskStatus(task.status) &&
    (task.result === undefined || typeof task.result === "string") &&
    (task.error === undefined || typeof task.error === "string")
  );
}

function isTaskType(value: unknown): value is TaskPlan["tasks"][number]["type"] {
  return value === "research" || value === "code" || value === "test" || value === "verify";
}

function isTaskStatus(value: unknown): value is TaskPlan["tasks"][number]["status"] {
  return value === "pending" || value === "running" || value === "completed" || value === "failed";
}
