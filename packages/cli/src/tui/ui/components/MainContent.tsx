import type React from "react";
import { Box, Static } from "ink";
import type { HistoryItem } from "../types.js";
import { HistoryItemDisplay } from "./HistoryItemDisplay.js";

interface MainContentProps {
  history: HistoryItem[];
  pendingAssistantText: string;
  terminalWidth: number;
  mainAreaWidth: number;
  isFocused?: boolean;
}

export const MainContent: React.FC<MainContentProps> = ({
  history,
  pendingAssistantText,
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
  </Box>
);
