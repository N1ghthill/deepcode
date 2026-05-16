import type React from "react";
import { Box, Static } from "ink";
import type { TaskPlan } from "@deepcode/core";
import type { HistoryItem, IndividualToolCallDisplay } from "../types.js";
import { HistoryItemDisplay } from "./HistoryItemDisplay.js";
import { TaskPlanPanel } from "./TaskPlanPanel.js";

interface MainContentProps {
  history: HistoryItem[];
  pendingAssistantText: string;
  /** Tool calls executing in the current turn, surfaced live below <Static>. */
  liveToolCalls: IndividualToolCallDisplay[];
  /** Agent task plan for the current turn, or null when not a planned run. */
  taskPlan: TaskPlan | null;
  /** Streaming text accumulated per task id while it runs. */
  taskStreams: Record<string, string>;
  terminalWidth: number;
  mainAreaWidth: number;
  isFocused?: boolean;
}

export const MainContent: React.FC<MainContentProps> = ({
  history,
  pendingAssistantText,
  liveToolCalls,
  taskPlan,
  taskStreams,
  terminalWidth,
  mainAreaWidth,
  isFocused = true,
}) => (
  <Box flexDirection="column" flexGrow={1}>
    <Static items={history}>
      {(item) => (
        <HistoryItemDisplay
          key={item.id}
          item={item}
          terminalWidth={terminalWidth}
          mainAreaWidth={mainAreaWidth}
          isPending={false}
          isFocused={isFocused}
        />
      )}
    </Static>
    {pendingAssistantText.trim().length > 0 && (
      <HistoryItemDisplay
        item={{ id: -1, type: "gemini", text: pendingAssistantText }}
        terminalWidth={terminalWidth}
        mainAreaWidth={mainAreaWidth}
        isPending={true}
        isFocused={isFocused}
      />
    )}
    {liveToolCalls.length > 0 && (
      <HistoryItemDisplay
        item={{ id: -2, type: "tool_group", tools: liveToolCalls }}
        terminalWidth={terminalWidth}
        mainAreaWidth={mainAreaWidth}
        isPending={true}
        isFocused={isFocused}
      />
    )}
    {taskPlan && <TaskPlanPanel plan={taskPlan} taskStreams={taskStreams} />}
  </Box>
);
