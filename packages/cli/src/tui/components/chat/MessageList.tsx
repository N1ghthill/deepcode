import React from "react";
import { Box, Text, useStdout } from "ink";
import {
  collectSecretValues,
  redactText,
} from "@deepcode/core";
import type { Message } from "@deepcode/shared";
import type { ThemeColors } from "../../themes.js";
import type { DeepCodeRuntime } from "../../../runtime.js";
import { useVirtualScroll } from "../../hooks/useVirtualScroll.js";
import { t } from "../../i18n/index.js";

interface MessageListProps {
  messages: Message[];
  assistantDraft: string;
  streaming: boolean;
  runtime: DeepCodeRuntime;
  theme: ThemeColors;
  viewportReserved?: number;
}

function estimateMessageHeight(msg: Message, terminalWidth: number): number {
  const labelHeight = 1;
  const spacerHeight = 1;
  const contentLines = Math.max(1, Math.ceil(msg.content.length / Math.max(terminalWidth - 4, 40)));
  return labelHeight + contentLines + spacerHeight;
}

export function MessageList({
  messages,
  assistantDraft,
  streaming,
  runtime,
  theme,
  viewportReserved = 12,
}: MessageListProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;
  const viewportHeight = Math.max(4, (stdout.rows ?? 24) - viewportReserved);
  const secretValues = collectSecretValues(runtime.config);

  const { visibleItems, canScrollUp, canScrollDown } = useVirtualScroll(
    messages,
    viewportHeight,
    (msg) => estimateMessageHeight(msg, terminalWidth),
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {canScrollUp && (
        <Text color={theme.fgMuted}>↑ {t("scrollHint")}</Text>
      )}

      {visibleItems.map((msg) => (
        <Box key={msg.id} flexDirection="column">
          <Text
            color={msg.role === "user" ? theme.userMsg : theme.assistantMsg}
            bold
          >
            {msg.role === "user" ? t("you") : t("deepCodeLabel")}
          </Text>
          <Text>{redactText(msg.content, secretValues)}</Text>
          <Text> </Text>
        </Box>
      ))}

      {streaming && assistantDraft && (
        <Box flexDirection="column">
          <Text color={theme.assistantMsg} bold>
            {t("deepCodeDraft")}
          </Text>
          <Text dimColor>{assistantDraft}</Text>
          <Text> </Text>
        </Box>
      )}

      {canScrollDown && (
        <Text color={theme.fgMuted}>↓ {t("scrollHint")}</Text>
      )}
    </Box>
  );
}
