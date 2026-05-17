import React from "react";
import { Text } from "ink";
import { useUIState } from "../../contexts/UIStateContext.js";
import { theme } from "../../semantic-colors.js";

export function BackgroundTasksPill(): React.ReactElement | null {
  const { activeSubagentCount } = useUIState();
  if (activeSubagentCount <= 0) return null;
  return (
    <Text color={theme.text.accent}>
      {" "}
      {activeSubagentCount} task{activeSubagentCount !== 1 ? "s" : ""}
    </Text>
  );
}
