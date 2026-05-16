import React from "react";
import { Box, Text, useStdout } from "ink";
import type { TaskPlan } from "@deepcode/core";
import type { ThemeColors } from "../../themes.js";
import { truncate } from "../../utils/truncate.js";

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  running: "▶",
  completed: "✓",
  failed: "✗",
};

interface ProgressMatrixProps {
  plan: TaskPlan;
  theme: ThemeColors;
}

export function ProgressMatrix({ plan, theme }: ProgressMatrixProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;

  const tasks = plan.tasks;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const barWidth = Math.min(Math.max(terminalWidth - 20, 16), 40);
  const filled = Math.round((completed / Math.max(total, 1)) * barWidth);
  const failedBars = Math.round((failed / Math.max(total, 1)) * barWidth);
  const runningPos = running > 0 ? filled : -1;

  let bar = "";
  for (let i = 0; i < barWidth; i += 1) {
    if (i < filled - failedBars) bar += "█";
    else if (i < filled) bar += "▓";
    else if (i === runningPos) bar += "▌";
    else bar += "·";
  }

  const colWidth = Math.floor((terminalWidth - 2) / 4);
  const itemsPerRow = Math.max(1, Math.floor((terminalWidth - 2) / colWidth));
  const rows: typeof tasks[] = [];
  for (let i = 0; i < tasks.length; i += itemsPerRow) {
    rows.push(tasks.slice(i, i + itemsPerRow));
  }

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle="round"
      borderColor={theme.border}
      marginBottom={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          <Text color={theme.accent} bold>
            ◆
          </Text>
          <Text color={theme.fg} bold>
            {plan.objective ? truncate(plan.objective, terminalWidth - 24) : "Plan"}
          </Text>
        </Box>
        <Text color={theme.fgMuted}>
          {completed}/{total}
        </Text>
      </Box>

      <Box flexDirection="row" gap={1}>
        <Text color={theme.success}>{bar.slice(0, filled - failedBars)}</Text>
        <Text color={theme.error}>{bar.slice(filled - failedBars, filled)}</Text>
        <Text color={theme.primary}>
          {runningPos >= 0 ? bar.slice(filled, filled + 1) : ""}
        </Text>
        <Text color={theme.fgMuted} dimColor>
          {bar.slice(Math.max(filled, runningPos + 1))}
        </Text>
        <Text color={theme.accent} bold>
          {percentage}%
        </Text>
      </Box>

      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row">
          {row.map((task) => {
            const icon = STATUS_ICON[task.status] ?? "?";
            const color =
              task.status === "completed"
                ? theme.success
                : task.status === "failed"
                  ? theme.error
                  : task.status === "running"
                    ? theme.primary
                    : theme.fgMuted;
            const label = truncate(task.description, colWidth - 4);
            return (
              <Box key={task.id} width={colWidth}>
                <Text color={color}>
                  {icon} {label}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}

      <Box flexDirection="row" gap={2}>
        {completed > 0 && (
          <Text color={theme.success}>✓ {completed}</Text>
        )}
        {running > 0 && (
          <Text color={theme.primary}>▶ {running}</Text>
        )}
        {failed > 0 && (
          <Text color={theme.error}>✗ {failed}</Text>
        )}
        {pending > 0 && (
          <Text color={theme.fgMuted} dimColor>○ {pending}</Text>
        )}
      </Box>
    </Box>
  );
}
