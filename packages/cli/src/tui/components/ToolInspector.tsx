import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../themes.js";
import { t } from "../i18n/index.js";

interface ToolCall {
  id: string;
  name: string;
  args: string;
  result?: string;
}

interface ToolInspectorProps {
  toolCalls: ToolCall[];
  toolExecuting: boolean;
  theme: ThemeColors;
  isActive?: boolean;
  onClose?: () => void;
}

const LIST_SIZE = 6;

function formatValue(v: unknown, max = 60): string {
  const s = typeof v === "string" ? v : JSON.stringify(v) ?? "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function ToolInspector({
  toolCalls,
  toolExecuting,
  theme,
  isActive,
  onClose,
}: ToolInspectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, toolCalls.length - 1));

  useEffect(() => {
    setSelectedIndex(Math.max(0, toolCalls.length - 1));
  }, [toolCalls.length]);

  const clamped = Math.max(0, Math.min(selectedIndex, Math.max(0, toolCalls.length - 1)));
  const selected = toolCalls[clamped];

  const windowStart = Math.max(0, Math.min(clamped - Math.floor(LIST_SIZE / 2), Math.max(0, toolCalls.length - LIST_SIZE)));
  const visible = toolCalls.slice(windowStart, windowStart + LIST_SIZE);

  useInput(
    (_, key) => {
      if (key.escape) { onClose?.(); return; }
      if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setSelectedIndex((i) => Math.min(toolCalls.length - 1, i + 1));
    },
    { isActive: Boolean(isActive) },
  );

  let parsedArgs: Record<string, unknown> = {};
  try { parsedArgs = JSON.parse(selected?.args ?? "{}"); } catch { /* ignore */ }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.primary}>{t("toolInspectorTitle")}</Text>
        <Text color={theme.fgMuted} dimColor>{t("toolInspectorHint")}</Text>
      </Box>

      {toolCalls.length === 0 ? (
        <Text color={theme.fgMuted} dimColor>
          {toolExecuting ? t("toolInspectorExecuting") : t("toolInspectorEmpty")}
        </Text>
      ) : (
        <>
          {/* Tool list */}
          <Box flexDirection="column" marginBottom={1}>
            {visible.map((tc, i) => {
              const absIdx = windowStart + i;
              const sel = absIdx === clamped;
              const done = tc.result !== undefined;
              return (
                <Box key={tc.id} flexDirection="row" gap={1}>
                  <Text color={sel ? theme.primary : theme.fgMuted}>{sel ? "▶" : " "}</Text>
                  <Text color={done ? theme.success : theme.warning}>
                    {done ? "✓" : toolExecuting && absIdx === toolCalls.length - 1 ? "…" : "○"}
                  </Text>
                  <Text color={sel ? theme.fg : theme.fgMuted} bold={sel}>
                    {tc.name}
                  </Text>
                </Box>
              );
            })}
          </Box>

          {/* Selected detail */}
          {selected && (
            <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
              <Text bold color={theme.fg}>{selected.name}</Text>
              <Text> </Text>

              {Object.entries(parsedArgs).slice(0, 5).map(([k, v]) => (
                <Box key={k} flexDirection="row" gap={1}>
                  <Text color={theme.accent}>{k}:</Text>
                  <Text color={theme.fgMuted} wrap="truncate">{formatValue(v)}</Text>
                </Box>
              ))}

              {selected.result !== undefined && (
                <>
                  <Text> </Text>
                  <Text bold color={theme.fg}>{t("toolInspectorResult")}</Text>
                  <Text color={theme.fgMuted} wrap="wrap">
                    {formatValue(selected.result, 300)}
                  </Text>
                </>
              )}
            </Box>
          )}

          {toolCalls.length > LIST_SIZE && (
            <Box marginTop={1}>
              <Text color={theme.fgMuted} dimColor>
                {windowStart + 1}–{Math.min(windowStart + LIST_SIZE, toolCalls.length)}/{toolCalls.length}
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
