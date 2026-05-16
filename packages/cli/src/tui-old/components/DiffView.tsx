import React from "react";
import { Box, Text } from "ink";
import { createTwoFilesPatch } from "diff";
import type { ThemeColors } from "../themes.js";

interface DiffViewProps {
  oldText: string;
  newText: string;
  oldPath?: string;
  newPath?: string;
  theme: ThemeColors;
  maxLines?: number;
  context?: number;
}

type LineType = "added" | "removed" | "meta" | "context" | "header";

interface DiffLine {
  type: LineType;
  content: string;
}

function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("---") || raw.startsWith("+++")) {
      lines.push({ type: "header", content: raw });
    } else if (raw.startsWith("@@")) {
      lines.push({ type: "meta", content: raw });
    } else if (raw.startsWith("+")) {
      lines.push({ type: "added", content: raw });
    } else if (raw.startsWith("-")) {
      lines.push({ type: "removed", content: raw });
    } else if (raw !== "\\ No newline at end of file") {
      lines.push({ type: "context", content: raw });
    }
  }
  return lines;
}

function highlightToken(text: string, theme: ThemeColors): React.ReactNode {
  // Basic keyword highlighting for TS/JS
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await|new|this|null|undefined|true|false)\b/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = keywords.exec(text)) !== null) {
    if (m.index > last) parts.push(<Text key={last}>{text.slice(last, m.index)}</Text>);
    parts.push(<Text key={m.index} color={theme.warning}>{m[0]}</Text>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<Text key={last}>{text.slice(last)}</Text>);
  return parts.length > 0 ? <>{parts}</> : <Text>{text}</Text>;
}

export function DiffView({
  oldText,
  newText,
  oldPath = "a/file",
  newPath = "b/file",
  theme,
  maxLines = 80,
  context = 3,
}: DiffViewProps) {
  const patch = createTwoFilesPatch(oldPath, newPath, oldText, newText, "", "", { context });
  const lines = parsePatch(patch).slice(0, maxLines);

  const addedCount = lines.filter((l) => l.type === "added").length;
  const removedCount = lines.filter((l) => l.type === "removed").length;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border}>
      <Box paddingX={1} gap={2}>
        <Text bold color={theme.primary}>{newPath}</Text>
        <Text color={theme.success}>+{addedCount}</Text>
        <Text color={theme.error}>-{removedCount}</Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, idx) => {
          if (line.type === "header") {
            return (
              <Text key={idx} color={theme.fgMuted} dimColor>
                {line.content}
              </Text>
            );
          }
          if (line.type === "meta") {
            return (
              <Text key={idx} color={theme.accent}>
                {line.content}
              </Text>
            );
          }
          if (line.type === "added") {
            return (
              <Box key={idx} flexDirection="row">
                <Text color={theme.success}>{highlightToken(line.content, theme)}</Text>
              </Box>
            );
          }
          if (line.type === "removed") {
            return (
              <Box key={idx} flexDirection="row">
                <Text color={theme.error}>{line.content}</Text>
              </Box>
            );
          }
          return (
            <Text key={idx} color={theme.fgMuted} dimColor>
              {line.content}
            </Text>
          );
        })}
      </Box>

      {lines.length >= maxLines && (
        <Box paddingX={1}>
          <Text color={theme.fgMuted} dimColor>... diff truncated</Text>
        </Box>
      )}
    </Box>
  );
}
