import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { ThemeColors } from "../themes.js";
import type { TaskStreamBuffer } from "../store/agent-store.js";
import { TaskLane } from "./tasks/TaskLane.js";

const MAX_LANES = 4;

interface ParallelTaskViewProps {
  taskBuffers: Record<string, TaskStreamBuffer>;
  streaming: boolean;
  theme: ThemeColors;
  isActive?: boolean;
}

export function ParallelTaskView({
  taskBuffers,
  streaming,
  theme,
  isActive = false,
}: ParallelTaskViewProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 120;
  const [laneOffset, setLaneOffset] = useState(0);
  const [focusedLane, setFocusedLane] = useState(0);

  const allBuffers = Object.values(taskBuffers);
  const visibleBuffers = allBuffers.slice(laneOffset, laneOffset + MAX_LANES);
  const laneWidth = Math.floor((terminalWidth - 4) / Math.max(1, visibleBuffers.length));

  const completed = allBuffers.filter((b) => b.status === "completed").length;
  const failed = allBuffers.filter((b) => b.status === "failed").length;
  const running = allBuffers.filter((b) => b.status === "running").length;

  useInput(
    (inputChar, key) => {
      if (inputChar === "]") setLaneOffset((o) => Math.min(o + 1, Math.max(0, allBuffers.length - MAX_LANES)));
      if (inputChar === "[") setLaneOffset((o) => Math.max(0, o - 1));
      if (key.rightArrow) setFocusedLane((i) => Math.min(visibleBuffers.length - 1, i + 1));
      if (key.leftArrow) setFocusedLane((i) => Math.max(0, i - 1));
    },
    { isActive },
  );

  if (allBuffers.length === 0) return null;

  const isDone = !streaming && allBuffers.length > 0;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="row" gap={2} paddingX={1} marginBottom={1}>
        <Text bold color={theme.primary}>Subagents</Text>
        <Text color={theme.success}>✅ {completed}</Text>
        {running > 0 && <Text color={theme.warning}>🔄 {running}</Text>}
        {failed > 0 && <Text color={theme.error}>❌ {failed}</Text>}
        <Text color={theme.fgMuted} dimColor>
          [{laneOffset + 1}-{Math.min(laneOffset + MAX_LANES, allBuffers.length)}/{allBuffers.length}]
        </Text>
      </Box>

      {/* Lanes */}
      <Box flexDirection="row">
        {visibleBuffers.map((buffer, idx) => (
          <TaskLane
            key={buffer.taskId}
            buffer={buffer}
            width={laneWidth}
            theme={theme}
          />
        ))}
      </Box>

      {/* Summary when done */}
      {isDone && (
        <Box flexDirection="column" paddingX={1} marginTop={1} borderStyle="single" borderColor={theme.border}>
          <Text bold color={theme.primary}>Resumo</Text>
          {allBuffers.map((b) => (
            <Box key={b.taskId} flexDirection="row" gap={1}>
              <Text color={b.status === "completed" ? theme.success : b.status === "failed" ? theme.error : theme.fgMuted}>
                {b.status === "completed" ? "✅" : b.status === "failed" ? "❌" : "⏳"}
              </Text>
              <Text color={theme.fg}>{b.description}</Text>
              {b.completedAt && b.startedAt && (
                <Text color={theme.fgMuted} dimColor>
                  {((b.completedAt - b.startedAt) / 1000).toFixed(1)}s
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {allBuffers.length > MAX_LANES && (
        <Box paddingX={1}>
          <Text color={theme.fgMuted} dimColor>[ navigate lanes · ] next</Text>
        </Box>
      )}
    </Box>
  );
}
