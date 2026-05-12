import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { SessionStats } from "@deepcode/core";
import { t } from "../../i18n/index.js";

export interface TelemetryPanelProps {
  theme: ThemeColors;
  stats: SessionStats | null;
  allSessions?: SessionStats[];
  toolBreakdown?: Record<string, number>;
  onExport?: () => Promise<void>;
  exportStatus?: 'idle' | 'exporting' | 'success' | 'error';
  lastExportPath?: string | null;
  onClose?: () => void;
}

export function TelemetryPanel({
  theme,
  stats,
  allSessions = [],
  toolBreakdown,
  onExport,
  exportStatus = 'idle',
  lastExportPath = null,
  onClose,
}: TelemetryPanelProps) {
  const [navigateIndex, setNavigateIndex] = useState(0);
  const hasHistory = allSessions.length > 1;

  const navigate = useCallback((direction: -1 | 1) => {
    if (!hasHistory) return;
    setNavigateIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return allSessions.length - 1;
      if (next >= allSessions.length) return 0;
      return next;
    });
  }, [hasHistory, allSessions.length]);

  const navigateSession = hasHistory ? allSessions[navigateIndex] : null;

  useInput((inputChar, key) => {
    if (inputChar?.toLowerCase() === 'e' && onExport && exportStatus !== 'exporting') {
      void onExport();
    }
    if (key.escape && onClose) {
      onClose();
    }
    if (key.leftArrow && hasHistory) {
      navigate(-1);
    }
    if (key.rightArrow && hasHistory) {
      navigate(1);
    }
  });

  const displayStats = navigateSession ?? stats;

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

  if (!displayStats) {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={theme.borderActive}
        paddingX={1}
      >
        <Text bold color={theme.primary}>
          {t("telemetryTitle")}
        </Text>
        <Text color={theme.fgMuted}>
          {t("telemetryNoStats")}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.borderActive}
      paddingX={1}
    >
      <Text bold color={theme.primary}>
        {t("telemetrySessionTitle")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("telemetryEscClose")}{hasHistory ? t("telemetryNavigateHistory") : ""}{t("telemetryExportKey")}
      </Text>

      {hasHistory && (
        <Text color={theme.fgMuted}>
          {t("telemetrySessionOf", { index: navigateIndex + 1, total: allSessions.length })}
        </Text>
      )}

      <Text> </Text>

      <Box flexDirection="column">
        <Text bold>{t("telemetrySummary")}</Text>
        <Text color={theme.fgMuted}>
          {t("telemetrySessionLabel")}{displayStats.sessionId.slice(0, 12)}...
        </Text>
        <Text color={theme.fgMuted}>
          {t("telemetryProviderLabel")}{displayStats.provider}
        </Text>
        <Text color={theme.fgMuted}>
          {t("telemetryModelLabel")}{displayStats.model || t("notConfigured")}
        </Text>
        <Text color={theme.fgMuted}>
          {t("telemetryDurationLabel")}{formatDuration(displayStats.duration)}
        </Text>
        <Text> </Text>

        <Text bold>{t("telemetryTokenUsage")}</Text>
        <Text color={theme.accent}>
          {t("telemetryInputLabel")}{formatTokens(displayStats.inputTokens)}{t("telemetryTokensSuffix")}
        </Text>
        <Text color={theme.accent}>
          {t("telemetryOutputLabel")}{formatTokens(displayStats.outputTokens)}{t("telemetryTokensSuffix")}
        </Text>
        <Text color={theme.accent}>
          {t("totalLabel")} {formatTokens(displayStats.inputTokens + displayStats.outputTokens)}{t("telemetryTokensSuffix")}
        </Text>
        <Text> </Text>

        <Text bold>{t("telemetryEstimatedCost")}</Text>
        <Text color={theme.success} bold>
          ${(displayStats.estimatedCost ?? 0).toFixed(4)}
        </Text>
        <Text> </Text>

        <Text bold>{t("telemetryToolCalls")}</Text>
        <Text color={theme.fgMuted}>
          {t("totalLabel")}{displayStats.toolCalls}
        </Text>
        {displayStats.errorCount > 0 && (
          <>
            <Text> </Text>
            <Text bold color={theme.error}>{t("telemetryErrors")}</Text>
            <Text color={theme.error}>
              {t("totalLabel")}{displayStats.errorCount}
            </Text>
          </>
        )}
        {toolBreakdown && Object.keys(toolBreakdown).length > 0 && !navigateSession && (
          <>
            <Text color={theme.fgMuted}>
              {Object.entries(toolBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => `${name}: ${count}`)
                .join(" | ")}
            </Text>
          </>
        )}
      </Box>

      <Text> </Text>
      <Text color={theme.fgMuted} dimColor>
        {t("telemetryCostDisclaimer")}
      </Text>

      <Text> </Text>
      <Text bold>{t("telemetryExportSection")}</Text>
      {exportStatus === 'exporting' ? (
        <Text color={theme.warning}>{t("telemetryExporting")}</Text>
      ) : exportStatus === 'success' ? (
        <Text color={theme.success}>{t("telemetryExportedTo", { path: lastExportPath ?? "" })}</Text>
      ) : exportStatus === 'error' ? (
        <Text color={theme.error}>{t("telemetryExportError")}</Text>
      ) : (
        <Text color={theme.fgMuted}>{t("telemetryPressEToExport")}</Text>
      )}
    </Box>
  );
}
