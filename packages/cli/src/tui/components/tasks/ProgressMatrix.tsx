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
  const elapsed = "";

  // Columns per row: fit ~4 per line at standard widths
  const colWidth = Math.floor((terminalWidth - 2) / 4);
  const itemsPerRow = Math.max(1, Math.floor((terminalWidth - 2) / colWidth));
  const rows: typeof tasks[] = [];
  for (let i = 0; i < tasks.length; i += itemsPerRow) {
    rows.push(tasks.slice(i, i + itemsPerRow));
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={theme.accent} bold>
        {plan.objective ? truncate(plan.objective, terminalWidth - 4) : "Plan"}
      </Text>
      <Text color={theme.fgMuted}>
        {"═".repeat(Math.min(terminalWidth - 4, 60))}
      </Text>
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
            const label = truncate(`[${task.type}] ${task.description}`, colWidth - 6);
            return (
              <Box key={task.id} width={colWidth}>
                <Text color={color}>
                  {icon} {label}{"  "}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
      <Text color={theme.fgMuted}>
        {"═".repeat(Math.min(terminalWidth - 4, 60))}
      </Text>
      <Text color={theme.fgMuted}>
        {completed}/{total} done
        {running > 0 ? ` · ${running} running` : ""}
        {failed > 0 ? ` · ${failed} failed` : ""}
        {pending > 0 ? ` · ${pending} pending` : ""}
        {elapsed ? ` · ${elapsed}` : ""}
      </Text>
    </Box>
  );
}
