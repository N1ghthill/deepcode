import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../themes.js";

interface FileTreePanelProps {
  files: string[];
  theme: ThemeColors;
  cwd: string;
}

const MAX_VISIBLE = 40;

export function FileTreePanel({ files, theme, cwd }: FileTreePanelProps) {
  const normalize = (f: string) =>
    f.startsWith(cwd + "/") ? f.slice(cwd.length + 1) : f.startsWith(cwd) ? f.slice(cwd.length) : f;

  const visible = files.slice(0, MAX_VISIBLE);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.primary}>Context</Text>
        <Text color={theme.fgMuted}> ({files.length} files)</Text>
      </Box>
      {visible.map((file, idx) => (
        <Text key={idx} color={theme.fgMuted} dimColor>
          {normalize(file)}
        </Text>
      ))}
      {files.length > MAX_VISIBLE && (
        <Text color={theme.fgMuted} dimColor>+{files.length - MAX_VISIBLE} more…</Text>
      )}
      {files.length === 0 && (
        <Text color={theme.fgMuted} dimColor>Loading…</Text>
      )}
    </Box>
  );
}
