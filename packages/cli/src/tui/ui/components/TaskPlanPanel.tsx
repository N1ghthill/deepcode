import type React from "react";
import { Box, Text } from "ink";
import type { Task, TaskPlan } from "@deepcode/core";
import { theme } from "../semantic-colors.js";

interface TaskPlanPanelProps {
  plan: TaskPlan;
  /** Streaming text accumulated per task id while it runs. */
  taskStreams: Record<string, string>;
}

const STATUS_ICON: Record<Task["status"], string> = {
  pending: "○",
  running: "◐",
  completed: "✓",
  failed: "✗",
};

function statusColor(status: Task["status"]): string {
  switch (status) {
    case "completed":
      return theme.status.success;
    case "failed":
      return theme.status.error;
    case "running":
      return theme.text.accent;
    default:
      return theme.text.secondary;
  }
}

/** Last non-empty line of a streaming buffer, trimmed to one terminal row. */
function streamTail(stream: string, max = 100): string {
  const lines = stream.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const last = lines[lines.length - 1] ?? "";
  return last.length > max ? `${last.slice(0, max - 1)}…` : last;
}

/**
 * Live view of the agent's task plan, rendered below <Static> while a planned
 * run is in flight. Each task shows its status; the running task also shows a
 * one-line tail of its streaming output. DeepCode-authored (not ported).
 */
export const TaskPlanPanel: React.FC<TaskPlanPanelProps> = ({ plan, taskStreams }) => {
  const completed = plan.tasks.filter((task) => task.status === "completed").length;

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      marginLeft={2}
      marginRight={2}
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
    >
      <Text bold color={theme.text.accent}>
        Plan · {plan.objective}{" "}
        <Text color={theme.text.secondary}>
          ({completed}/{plan.tasks.length})
        </Text>
      </Text>
      {plan.tasks.map((task) => {
        const tail = task.status === "running" ? streamTail(taskStreams[task.id] ?? "") : "";
        return (
          <Box key={task.id} flexDirection="column">
            <Text color={statusColor(task.status)}>
              {STATUS_ICON[task.status]} {task.description}
              {task.error ? (
                <Text color={theme.status.error}> — {task.error}</Text>
              ) : null}
            </Text>
            {tail ? <Text color={theme.text.secondary}>{"  "}{tail}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
};
