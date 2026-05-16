import React from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import { t } from "../../i18n/index.js";

export interface InputPreviewProps {
  theme: ThemeColors;
  input: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
  estimatedTokens?: number;
}

export function InputPreview({
  theme,
  input,
  onConfirm,
  onCancel,
  onEdit,
  estimatedTokens,
}: InputPreviewProps) {
  useInput((inputChar, key) => {
    if (key.return) {
      onConfirm();
    } else if (key.escape) {
      onCancel();
    } else if (inputChar?.toLowerCase() === 'e') {
      onEdit();
    }
  });

  const lines = input.split('\n');
  const displayLines = lines.slice(0, 20);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.borderActive}
      paddingX={1}
    >
      <Text bold color={theme.primary}>
        {t("inputPreviewTitle")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("inputPreviewHint")}
      </Text>
      <Text> </Text>

      {estimatedTokens !== undefined && (
        <Text color={theme.accent}>
          {t("inputPreviewEstimatedTokens", { count: estimatedTokens })}
        </Text>
      )}

      <Text color={theme.fgMuted}>---</Text>

      <Box flexDirection="column">
        {displayLines.map((line, index) => (
          <Text key={index} color={theme.userMsg}>
            {line || " "}
          </Text>
        ))}
        {lines.length > 20 && (
          <Text color={theme.fgMuted} dimColor>
            {t("inputPreviewMoreLines", { count: lines.length - 20 })}
          </Text>
        )}
      </Box>

      <Text color={theme.fgMuted}>---</Text>
      <Text> </Text>

      <Box flexDirection="column">
        <Text color={theme.success}>{t("inputPreviewSend")}</Text>
        <Text color={theme.warning}>{t("inputPreviewEdit")}</Text>
        <Text color={theme.error}>{t("inputPreviewCancel")}</Text>
      </Box>
    </Box>
  );
}
