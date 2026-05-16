import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../themes.js";
import type { ExecutionTask } from "../store/execution-store.js";

interface TaskProgressProps {
  tasks: ExecutionTask[];
  theme: ThemeColors;
  maxVisible?: number;
}

const STATUS_ICON: Record<ExecutionTask["status"], string> = {
  queued: "⏳",
  running: "🔄",
  completed: "✅",
  failed: "❌",
};

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TaskProgress({ tasks, theme, maxVisible = 6 }: TaskProgressProps) {
  if (tasks.length === 0) return null;

  const recent = tasks.slice(-maxVisible);

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      {recent.map((task) => (
        <Box key={task.id} flexDirection="row" gap={1}>
          <Text>{STATUS_ICON[task.status]}</Text>
          <Text
            color={
              task.status === "completed"
                ? theme.success
                : task.status === "failed"
                ? theme.error
                : task.status === "running"
                ? theme.warning
                : theme.fgMuted
            }
          >
            {task.description}
          </Text>
          {task.model && task.status === "running" && (
            <Text color={theme.fgMuted} dimColor>
              ({task.model})
            </Text>
          )}
          {task.status === "completed" && task.result && (
            <Text color={theme.fgMuted} dimColor>
              - {task.result}
            </Text>
          )}
          {task.durationMs !== undefined && task.status === "completed" && (
            <Text color={theme.fgMuted} dimColor>
              {formatDuration(task.durationMs)}
            </Text>
          )}
          {task.status === "failed" && task.error && (
            <Text color={theme.error} dimColor>
              - {task.error.slice(0, 60)}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
