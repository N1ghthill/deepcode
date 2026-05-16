import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { SessionStats } from "@deepcode/core";
import { t } from "../../i18n/index.js";

export interface TelemetrySidebarProps {
  theme: ThemeColors;
  stats: SessionStats | null;
  toolBreakdown?: Record<string, number>;
}

export function TelemetrySidebar({
  theme,
  stats,
  toolBreakdown,
}: TelemetrySidebarProps) {
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (!stats) {
    return (
      <Box flexDirection="column">
        <Text color={theme.fgMuted}>{t("telemetrySidebarNoData")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>{t("telemetrySummary")}</Text>
      <Text color={theme.fgMuted}>
        {t("telemetryProviderLabel")}{stats.provider}
      </Text>
      <Text color={theme.fgMuted}>
        {t("telemetryModelLabel")}{stats.model || t("notConfigured")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("telemetryDurationLabel")}{formatDuration(stats.duration)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.accent}>{t("telemetrySidebarTokens")}</Text>
      <Text color={theme.fgMuted}>
        {t("telemetryInputLabel")}{formatTokens(stats.inputTokens)}
      </Text>
      <Text color={theme.fgMuted}>
        {t("telemetryOutputLabel")}{formatTokens(stats.outputTokens)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.success}>{t("telemetrySidebarCost")}</Text>
      <Text color={theme.success}>
        ${(stats.estimatedCost ?? 0).toFixed(4)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.fgMuted}>{t("telemetryToolCalls")}</Text>
      <Text color={theme.fgMuted}>
        {t("totalLabel")}{stats.toolCalls}
      </Text>
      {stats.errorCount > 0 && (
        <>
          <Text> </Text>
          <Text bold color={theme.error}>{t("telemetryErrors")}</Text>
          <Text color={theme.error}>
            {t("totalLabel")}{stats.errorCount}
          </Text>
        </>
      )}
      {toolBreakdown && Object.keys(toolBreakdown).length > 0 && (
        <>
          <Text> </Text>
          <Text bold color={theme.fgMuted}>{t("telemetrySidebarBreakdown")}</Text>
          {Object.entries(toolBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => (
              <Text key={name} color={theme.fgMuted}>
                {name}: {count}
              </Text>
            ))}
        </>
      )}
    </Box>
  );
}
