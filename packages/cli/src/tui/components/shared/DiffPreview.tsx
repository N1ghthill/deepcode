import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";

export interface DiffPreviewProps {
  theme: ThemeColors;
  before: string;
  after: string;
  filePath: string;
  maxLines?: number;
}

export function DiffPreview({
  theme,
  before,
  after,
  filePath,
  maxLines = 30,
}: DiffPreviewProps) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  const diffLines: Array<{ type: 'context' | 'removed' | 'added'; content: string; lineNum: number }> = [];

  const maxLen = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < maxLen && diffLines.length < maxLines; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === undefined && afterLine !== undefined) {
      diffLines.push({ type: 'added', content: afterLine, lineNum: i + 1 });
    } else if (beforeLine !== undefined && afterLine === undefined) {
      diffLines.push({ type: 'removed', content: beforeLine, lineNum: i + 1 });
    } else if (beforeLine !== afterLine) {
      if (beforeLine !== undefined) {
        diffLines.push({ type: 'removed', content: beforeLine, lineNum: i + 1 });
      }
      if (afterLine !== undefined) {
        diffLines.push({ type: 'added', content: afterLine, lineNum: i + 1 });
      }
    } else {
      if (diffLines.length > 0 && diffLines[diffLines.length - 1]?.type === 'context') {
        diffLines.push({ type: 'context', content: beforeLine ?? '', lineNum: i + 1 });
      }
    }
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>
        Diff: {filePath}
      </Text>
      <Text color={theme.fgMuted}>
        {beforeLines.length} linhas → {afterLines.length} linhas
      </Text>
      <Text> </Text>

      {diffLines.map((line, idx) => (
        <Box key={idx}>
          <Text color={theme.fgMuted} dimColor>
            {String(line.lineNum).padStart(4, ' ')}│
          </Text>
          {line.type === 'removed' ? (
            <Text color={theme.error}>- {line.content}</Text>
          ) : line.type === 'added' ? (
            <Text color={theme.success}>+ {line.content}</Text>
          ) : (
            <Text color={theme.fgMuted}>  {line.content}</Text>
          )}
        </Box>
      ))}

      {diffLines.length >= maxLines && (
        <Text color={theme.fgMuted} dimColor>
          ... (truncado, use editor para ver completo)
        </Text>
      )}
    </Box>
  );
}
