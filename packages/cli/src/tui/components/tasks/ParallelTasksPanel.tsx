import React, { useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { TaskStreamBuffer } from "../../store/agent-store.js";
import { TaskLane } from "./TaskLane.js";
import { t } from "../../i18n/index.js";

const MAX_VISIBLE_LANES = 4;

interface ParallelTasksPanelProps {
  taskBuffers: Record<string, TaskStreamBuffer>;
  streaming: boolean;
  theme: ThemeColors;
}

export function ParallelTasksPanel({
  taskBuffers,
  streaming,
  theme,
}: ParallelTasksPanelProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;

  const [laneOffset, setLaneOffset] = useState(0);

  const runningBuffers = Object.values(taskBuffers).filter(
    (b) => b.status === "running" || b.status === "completed" || b.status === "failed",
  );

  useInput(
    (input) => {
      if (input === "]") {
        setLaneOffset((o) => Math.min(o + 1, Math.max(0, runningBuffers.length - MAX_VISIBLE_LANES)));
      }
      if (input === "[") {
        setLaneOffset((o) => Math.max(0, o - 1));
      }
    },
    { isActive: streaming && runningBuffers.length > 0 },
  );

  if (!streaming || runningBuffers.length === 0) return null;

  const visibleBuffers = runningBuffers.slice(laneOffset, laneOffset + MAX_VISIBLE_LANES);
  const count = Math.min(visibleBuffers.length, MAX_VISIBLE_LANES);
  const laneWidth = Math.floor((terminalWidth - 2) / count);
  const hiddenCount = runningBuffers.length - MAX_VISIBLE_LANES;

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        {visibleBuffers.map((buffer) => (
          <TaskLane
            key={buffer.taskId}
            buffer={buffer}
            width={laneWidth}
            theme={theme}
          />
        ))}
      </Box>
      {(hiddenCount > 0 || laneOffset > 0) && (
        <Text color={theme.fgMuted}>
          {laneOffset > 0 ? "[ prev  " : "        "}
          {hiddenCount > 0
            ? `+${hiddenCount} ${t("moreTasks")}  ] next`
            : ""}
        </Text>
      )}
    </Box>
  );
}
