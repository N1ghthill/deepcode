import React from "react";
import { Box, Text } from "ink";
import { theme } from "../semantic-colors.js";
import type { SubagentEntry } from "../contexts/UIStateContext.js";

function statusIcon(e: SubagentEntry): string {
  if (e.status === "done") return "✓";
  if (e.status === "failed") return "✗";
  return "…";
}

function statusColor(e: SubagentEntry): string {
  if (e.status === "done") return theme.status.success;
  if (e.status === "failed") return theme.status.error;
  return theme.text.accent;
}

interface SubagentsPanelProps {
  subagents: SubagentEntry[];
  mainAreaWidth: number;
}

export const SubagentsPanel: React.FC<SubagentsPanelProps> = ({ subagents, mainAreaWidth }) => {
  if (subagents.length === 0) return null;

  const running = subagents.filter((s) => s.status === "running").length;
  const title = running > 0
    ? `Subagents (${running} running)`
    : `Subagents (${subagents.length} finishing…)`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.text.accent}
      marginLeft={2}
      marginRight={2}
      marginTop={1}
      width={Math.min(mainAreaWidth, 80)}
    >
      <Box paddingX={1}>
        <Text bold color={theme.text.accent}>{title}</Text>
      </Box>
      {subagents.map((entry) => (
        <Box key={entry.taskId} flexDirection="column" paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={statusColor(entry)}>{statusIcon(entry)}</Text>
            <Text wrap="truncate" color={theme.text.primary}>
              {entry.prompt}{entry.prompt.length >= 50 ? "…" : ""}
            </Text>
          </Box>
          {entry.status === "running" && entry.currentTool && (
            <Text color={theme.text.secondary} dimColor>
              {"  "}using {entry.currentTool}
            </Text>
          )}
          {entry.status === "running" && !entry.currentTool && entry.currentOutput && (
            <Text color={theme.text.secondary} dimColor wrap="truncate">
              {"  "}{entry.currentOutput.trimStart()}
            </Text>
          )}
          {entry.status === "failed" && entry.error && (
            <Text color={theme.status.error} dimColor wrap="truncate">
              {"  "}{entry.error.slice(0, 60)}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
