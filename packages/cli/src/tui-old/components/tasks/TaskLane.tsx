import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { TaskStreamBuffer } from "../../store/agent-store.js";
import { truncate } from "../../utils/truncate.js";

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  running: "▶",
  completed: "✓",
  failed: "✗",
};

interface TaskLaneProps {
  buffer: TaskStreamBuffer;
  width: number;
  theme: ThemeColors;
}

export function TaskLane({ buffer, width, theme }: TaskLaneProps) {
  const typeColor = typeColorFor(buffer.type, theme);
  const statusIcon = STATUS_ICON[buffer.status] ?? "?";
  const statusColor =
    buffer.status === "completed"
      ? theme.success
      : buffer.status === "failed"
        ? theme.error
        : buffer.status === "running"
          ? theme.primary
          : theme.fgMuted;

  const innerWidth = Math.max(8, width - 4);
  const elapsed =
    buffer.startedAt
      ? `${Math.round((Date.now() - buffer.startedAt) / 1000)}s`
      : "";

  const retryBadge = buffer.attempt > 0 ? ` ⟳${buffer.attempt}` : "";

  const fullText = buffer.chunks.join("");
  const lines = fullText.split("\n").filter((l) => l.trim().length > 0);
  const visibleLines = lines.slice(-6);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={statusColor}
      width={width}
      paddingX={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          <Text backgroundColor={typeColor} color="black" bold>
            {" "}{buffer.type.toUpperCase().slice(0, 4)}{" "}
          </Text>
          <Text color={theme.fg}>
            {truncate(buffer.description, innerWidth - 14)}
          </Text>
        </Box>
        <Text color={statusColor} bold>
          {statusIcon}{retryBadge} {elapsed}
        </Text>
      </Box>

      {buffer.error && buffer.status === "running" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.warning} dimColor>
            ↻ {truncate(buffer.error, innerWidth)}
          </Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {visibleLines.length === 0 ? (
          <Text color={theme.fgMuted} dimColor>
            {buffer.status === "pending" ? "· aguardando" : "· processando"}
          </Text>
        ) : (
          visibleLines.map((line, i) => (
            <Text key={i} color={theme.fgMuted} dimColor>
              {truncate(line, innerWidth)}
            </Text>
          ))
        )}
        {buffer.status === "failed" && buffer.error && (
          <Text color={theme.error}>
            ✗ {truncate(buffer.error, innerWidth)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function typeColorFor(type: string, theme: ThemeColors): string {
  switch (type) {
    case "research":
      return theme.primary;
    case "code":
      return theme.success;
    case "test":
      return theme.warning;
    case "verify":
      return theme.accent;
    default:
      return theme.fg;
  }
}
