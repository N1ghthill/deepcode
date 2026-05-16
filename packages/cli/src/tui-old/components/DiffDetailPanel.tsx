import React from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../themes.js";
import { DiffView } from "./DiffView.js";
import { t } from "../i18n/index.js";

interface DiffDetailPanelProps {
  diff: { before: string; after: string; filePath: string } | null;
  theme: ThemeColors;
  isActive?: boolean;
  onClose?: () => void;
}

export function DiffDetailPanel({ diff, theme, isActive, onClose }: DiffDetailPanelProps) {
  useInput(
    (_, key) => { if (key.escape) onClose?.(); },
    { isActive: Boolean(isActive) },
  );

  if (!diff) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text color={theme.fgMuted} dimColor>{t("diffNoPendingChanges")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <DiffView
        oldText={diff.before}
        newText={diff.after}
        oldPath={diff.filePath}
        newPath={diff.filePath}
        theme={theme}
      />
      <Box paddingX={1}>
        <Text color={theme.fgMuted} dimColor>Esc close</Text>
      </Box>
    </Box>
  );
}
