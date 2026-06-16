import React from "react";
import { Box, Text } from "ink";
import { theme } from "../semantic-colors.js";
import type { SubagentEntry } from "../contexts/UIStateContext.js";
import { escapeAnsiCtrlCodes } from "../utils/textUtils.js";

function statusIcon(e: SubagentEntry): React.ReactNode {
  if (e.status === "running") {
    return <Text color={theme.text.accent}>◐</Text>;
  }
  if (e.status === "done") return <Text color={theme.status.success}>✓</Text>;
  return <Text color={theme.status.error}>✗</Text>;
}

function detailText(entry: SubagentEntry): string {
  if (entry.status === "failed") return entry.error ? "falhou: " + entry.error : "falhou";
  if (entry.status === "done") return "concluído";
  if (entry.currentTool) return `ferramenta: ${entry.currentTool}`;
  return "em execução";
}

function panelText(value: string, maxLength: number): string {
  const safe = escapeAnsiCtrlCodes(value).replace(/\s+/g, " ").trim();
  return safe.length > maxLength ? `${safe.slice(0, maxLength)}…` : safe;
}

interface SubagentsPanelProps {
  subagents: SubagentEntry[];
  mainAreaWidth: number;
}

export const SubagentsPanel: React.FC<SubagentsPanelProps> = ({ subagents, mainAreaWidth }) => {
  if (subagents.length === 0) return null;

  const running = subagents.filter((s) => s.status === "running").length;
  const done = subagents.filter((s) => s.status === "done").length;
  const failed = subagents.filter((s) => s.status === "failed").length;
  const activeEntry =
    subagents.find((s) => s.status === "running") ?? subagents[subagents.length - 1]!;

  let titleSuffix: string;
  if (running > 0) {
    titleSuffix = `${running} em execução`;
  } else if (failed > 0) {
    titleSuffix = `${done} ok · ${failed} falha${failed !== 1 ? "s" : ""}`;
  } else {
    titleSuffix = `${done} concluído${done !== 1 ? "s" : ""}`;
  }

  const borderColor =
    running > 0 ? theme.text.accent : failed > 0 ? theme.status.error : theme.status.success;
  const safeDetail = panelText(detailText(activeEntry), 48);
  const panelWidth = Math.max(20, Math.min(mainAreaWidth, 80));
  const summary = `${titleSuffix} · ${safeDetail}`;

  return (
    <Box
      flexDirection="row"
      marginLeft={2}
      marginRight={2}
      marginTop={1}
      width={panelWidth}
    >
      {statusIcon(activeEntry)}
      <Text color={borderColor} bold>
        {" Subagents"}
      </Text>
      <Text color={theme.text.secondary} wrap="truncate">
        {" · "}
        {summary}
      </Text>
    </Box>
  );
};
