import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { TaskStreamBuffer } from "../../store/agent-store.js";
import { truncate } from "../../utils/truncate.js";

const TYPE_COLOR: Record<string, string> = {
  research: "cyan",
  code: "green",
  test: "yellow",
  verify: "magenta",
};

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
  const typeColor = TYPE_COLOR[buffer.type] ?? "white";
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
  const headerLabel = `[${buffer.type}] ${truncate(buffer.description, innerWidth - 12)}`;
  const elapsed =
    buffer.startedAt
      ? `${Math.round((Date.now() - buffer.startedAt) / 1000)}s`
      : "";

  // Show retry indicator
  const retryBadge = buffer.attempt > 0 ? ` ⟳${buffer.attempt}` : "";

  // Last N lines from chunks
  const fullText = buffer.chunks.join("");
  const lines = fullText.split("\n").filter((l) => l.trim().length > 0);
  const visibleLines = lines.slice(-6);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={statusColor}
      width={width}
      paddingX={1}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text color={typeColor as "cyan" | "green" | "yellow" | "magenta"} bold>
          {truncate(headerLabel, innerWidth - 8)}
        </Text>
        <Text color={statusColor}>
          {statusIcon}{retryBadge} {elapsed}
        </Text>
      </Box>

      {/* Error from previous attempt */}
      {buffer.error && buffer.status === "running" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.warning} dimColor>
            prev: {truncate(buffer.error, innerWidth)}
          </Text>
          <Text color={theme.fgMuted} dimColor>────</Text>
        </Box>
      )}

      {/* Streaming output */}
      <Box flexDirection="column" marginTop={1}>
        {visibleLines.length === 0 ? (
          <Text color={theme.fgMuted} dimColor>
            {buffer.status === "pending" ? "waiting..." : "running..."}
          </Text>
        ) : (
          visibleLines.map((line, i) => (
            <Text key={i} color={theme.fg} dimColor>
              {truncate(line, innerWidth)}
            </Text>
          ))
        )}
        {buffer.status === "failed" && buffer.error && (
          <Text color={theme.error}>
            {truncate(buffer.error, innerWidth)}
          </Text>
        )}
      </Box>
    </Box>
  );
}
