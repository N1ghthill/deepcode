import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import {
  collectSecretValues,
  redactText,
} from "@deepcode/core";
import type { Message } from "@deepcode/shared";
import type { ThemeColors } from "../../themes.js";
import type { VimMode } from "../../types.js";
import type { DeepCodeRuntime } from "../../../runtime.js";
import { useVirtualScroll } from "../../hooks/useVirtualScroll.js";
import { MarkdownText } from "./MarkdownText.js";
import { t } from "../../i18n/index.js";

interface MessageListProps {
  messages: Message[];
  assistantDraft: string;
  streaming: boolean;
  runtime: DeepCodeRuntime;
  theme: ThemeColors;
  vimMode?: VimMode;
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
  vimMode,
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
    true,
    vimMode,
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {vimMode === "normal" && (
        <Box paddingX={1}>
          <Text color={theme.fgMuted} dimColor>j/k scroll · gg top · G bottom · Ctrl+d/u half-page · i insert</Text>
        </Box>
      )}
      {canScrollUp && (
        <Box flexDirection="row" gap={1} paddingX={1}>
          <Text color={theme.fgMuted} dimColor>
            ╴╴╴
          </Text>
          <Text color={theme.fgMuted} dimColor>
            ↑ {t("scrollHint")}
          </Text>
        </Box>
      )}

      {visibleItems.map((msg) => (
        <MessageRow
          key={msg.id}
          role={msg.role}
          content={redactText(msg.content, secretValues)}
          theme={theme}
        />
      ))}

      {streaming && assistantDraft && (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={theme.assistantMsg} bold>
              ◆
            </Text>
            <Text color={theme.assistantMsg} bold>
              {t("deepCodeLabel")}
            </Text>
            <BlinkingCursor theme={theme} />
          </Box>
          <Box paddingLeft={2}>
            <MarkdownText text={assistantDraft} theme={theme} />
          </Box>
        </Box>
      )}

      {canScrollDown && (
        <Box flexDirection="row" gap={1} paddingX={1}>
          <Text color={theme.fgMuted} dimColor>
            ╴╴╴
          </Text>
          <Text color={theme.fgMuted} dimColor>
            ↓ {t("scrollHint")}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function MessageRow({
  role,
  content,
  theme,
}: {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  theme: ThemeColors;
}) {
  const isUser = role === "user";
  const avatar = isUser ? "▸" : "◆";
  const color = isUser ? theme.userMsg : theme.assistantMsg;
  const label = isUser ? t("you") : t("deepCodeLabel");

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={color} bold>
          {avatar}
        </Text>
        <Text color={color} bold>
          {label}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <MarkdownText text={content} theme={theme} />
      </Box>
    </Box>
  );
}

function BlinkingCursor({ theme }: { theme: ThemeColors }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text color={theme.accent}>{visible ? "▍" : " "}</Text>
  );
}
