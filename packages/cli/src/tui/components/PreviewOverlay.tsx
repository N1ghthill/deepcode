import React from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../themes.js";
import type { PreviewFile } from "../hooks/usePreview.js";
import { DiffView } from "./DiffView.js";

const ACTION_ICON: Record<PreviewFile["action"], string> = {
  modify: "✏️",
  create: "➕",
  delete: "🗑️",
};

interface PreviewOverlayProps {
  summary: string;
  files: PreviewFile[];
  selectedIndex: number;
  theme: ThemeColors;
  isActive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function PreviewOverlay({
  summary,
  files,
  selectedIndex,
  theme,
  isActive = false,
  onConfirm,
  onCancel,
  onNext,
  onPrev,
}: PreviewOverlayProps) {
  useInput(
    (inputChar, key) => {
      if (key.escape || inputChar?.toLowerCase() === "n") { onCancel(); return; }
      if (key.return || inputChar?.toLowerCase() === "y") { onConfirm(); return; }
      if (key.tab || key.downArrow) { onNext(); return; }
      if (key.upArrow) { onPrev(); return; }
    },
    { isActive },
  );

  const selected = files[selectedIndex];

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.warning}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text color={theme.warning} bold>⚠ Preview de Alterações</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.fg}>{summary}</Text>
      </Box>

      {/* File list */}
      <Box flexDirection="column" marginBottom={1}>
        {files.map((file, idx) => (
          <Box key={idx} flexDirection="row" gap={1} paddingX={1}>
            <Text>{ACTION_ICON[file.action]}</Text>
            <Text
              color={idx === selectedIndex ? theme.selectionFg : theme.fg}
              backgroundColor={idx === selectedIndex ? theme.selectionBg : undefined}
            >
              {file.path}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Diff for selected file */}
      {selected && selected.before !== undefined && selected.after !== undefined && (
        <Box marginBottom={1}>
          <DiffView
            oldText={selected.before}
            newText={selected.after}
            oldPath={selected.path}
            newPath={selected.path}
            theme={theme}
            maxLines={20}
          />
        </Box>
      )}

      <Box flexDirection="row" gap={2}>
        <Text backgroundColor={theme.success} color="black" bold> Y confirmar </Text>
        <Text backgroundColor={theme.error} color="black" bold> N cancelar </Text>
        <Text color={theme.fgMuted} dimColor>Tab: próximo arquivo</Text>
        {files.length > 1 && (
          <Text color={theme.fgMuted} dimColor>
            [{selectedIndex + 1}/{files.length}]
          </Text>
        )}
      </Box>
    </Box>
  );
}
