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

function toolIcon(name: string): string {
  if (name === "bash" || name === "shell" || name.includes("bash")) return "⚡";
  if (name.includes("read") || name.includes("file")) return "📄";
  if (name.includes("write") || name.includes("edit")) return "✏";
  if (name.includes("search") || name.includes("grep")) return "🔍";
  if (name.includes("git")) return "⎇";
  if (name.includes("web") || name.includes("fetch")) return "🌐";
  return "◆";
}

function toolPreview(name: string, args: Record<string, unknown>): string {
  if (name === "bash" || name === "shell") {
    const cmd = args.command ?? args.cmd ?? args.input;
    return typeof cmd === "string" ? cmd.slice(0, 40) : "";
  }
  const path = args.path ?? args.file_path ?? args.filePath ?? args.filename;
  if (typeof path === "string") return path.split("/").slice(-2).join("/");
  const query = args.query ?? args.pattern ?? args.search ?? args.command;
  if (typeof query === "string") return query.slice(0, 40);
  return "";
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
  const preview = selected ? toolPreview(selected.name, parsedArgs) : "";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.primary}>{t("toolInspectorTitle")}</Text>
        <Text color={theme.fgMuted} dimColor>{toolCalls.length > 0 ? `${toolCalls.length}` : ""}</Text>
      </Box>

      {toolCalls.length === 0 ? (
        <Text color={theme.fgMuted} dimColor>
          {toolExecuting ? t("toolInspectorExecuting") : t("toolInspectorEmpty")}
        </Text>
      ) : (
        <>
          <Box flexDirection="column" marginBottom={1}>
            {visible.map((tc, i) => {
              const absIdx = windowStart + i;
              const sel = absIdx === clamped;
              const done = tc.result !== undefined;
              const running = toolExecuting && absIdx === toolCalls.length - 1;
              let tcArgs: Record<string, unknown> = {};
              try { tcArgs = JSON.parse(tc.args ?? "{}"); } catch { /* ignore */ }
              const linePreview = toolPreview(tc.name, tcArgs);
              return (
                <Box key={tc.id} flexDirection="column">
                  <Box flexDirection="row" gap={1}>
                    <Text color={done ? theme.success : running ? theme.warning : theme.fgMuted}>
                      {done ? "✓" : running ? "…" : "○"}
                    </Text>
                    <Text color={theme.accent}>{toolIcon(tc.name)}</Text>
                    <Text color={sel ? theme.fg : theme.fgMuted} bold={sel}>
                      {tc.name}
                    </Text>
                    {linePreview && (
                      <Text color={theme.fgMuted} dimColor wrap="truncate">
                        {linePreview}
                      </Text>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {selected && (
            <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
              <Box flexDirection="row" gap={1}>
                <Text color={theme.accent}>{toolIcon(selected.name)}</Text>
                <Text bold color={theme.fg}>{selected.name}</Text>
              </Box>

              {preview && (
                <Box marginTop={1}>
                  <Text color={theme.warning} wrap="wrap">{preview}</Text>
                </Box>
              )}

              {Object.entries(parsedArgs).slice(0, 4).map(([k, v]) => (
                <Box key={k} flexDirection="row" gap={1}>
                  <Text color={theme.fgMuted}>{k}:</Text>
                  <Text color={theme.fgMuted} dimColor wrap="truncate">{formatValue(v)}</Text>
                </Box>
              ))}

              {selected.result !== undefined && (
                <>
                  <Text> </Text>
                  <Text bold color={theme.fg}>{t("toolInspectorResult")}</Text>
                  <Text color={theme.fgMuted} wrap="wrap">
                    {formatValue(selected.result, 200)}
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
