import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import { t } from "../../i18n/index.js";

export interface CommandPreviewProps {
  theme: ThemeColors;
  command: string;
  args: string[];
  workingDir?: string;
  estimatedRisk?: 'low' | 'medium' | 'high';
}

export function CommandPreview({
  theme,
  command,
  args,
  workingDir,
  estimatedRisk,
}: CommandPreviewProps) {
  const fullCommand = `${command} ${args.join(' ')}`;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>
        {t("commandPreviewTitle")}
      </Text>
      <Text> </Text>

      {workingDir && (
        <Text color={theme.fgMuted}>
          {t("commandPreviewDirectory")}{workingDir}
        </Text>
      )}

      <Box paddingY={1}>
        <Text color={theme.warning} bold>
          $ {fullCommand}
        </Text>
      </Box>

      {estimatedRisk && (
        <Text color={
          estimatedRisk === 'high' ? theme.error :
          estimatedRisk === 'medium' ? theme.warning :
          theme.success
        }>
          {t("commandPreviewEstimatedRisk")}{estimatedRisk === 'high' ? t("commandPreviewRiskHigh") : estimatedRisk === 'medium' ? t("commandPreviewRiskMedium") : t("commandPreviewRiskLow")}
        </Text>
      )}

      <Text color={theme.fgMuted}>
        {t("commandPreviewArgs")}{args.map((a, i) => `[${i}] "${a}"`).join(', ')}
      </Text>
    </Box>
  );
}
