import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { SessionStats } from "@deepcode/core";

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
        <Text color={theme.fgMuted}>Sem dados de telemetria.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>Resumo</Text>
      <Text color={theme.fgMuted}>
        Provider: {stats.provider}
      </Text>
      <Text color={theme.fgMuted}>
        Modelo: {stats.model || "não configurado"}
      </Text>
      <Text color={theme.fgMuted}>
        Duração: {formatDuration(stats.duration)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.accent}>Tokens</Text>
      <Text color={theme.fgMuted}>
        Input:  {formatTokens(stats.inputTokens)}
      </Text>
      <Text color={theme.fgMuted}>
        Output: {formatTokens(stats.outputTokens)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.success}>Custo</Text>
      <Text color={theme.success}>
        ${(stats.estimatedCost ?? 0).toFixed(4)}
      </Text>
      <Text> </Text>

      <Text bold color={theme.fgMuted}>Tool Calls</Text>
      <Text color={theme.fgMuted}>
        Total: {stats.toolCalls}
      </Text>
      {stats.errorCount > 0 && (
        <>
          <Text> </Text>
          <Text bold color={theme.error}>Erros</Text>
          <Text color={theme.error}>
            Total: {stats.errorCount}
          </Text>
        </>
      )}
      {toolBreakdown && Object.keys(toolBreakdown).length > 0 && (
        <>
          <Text> </Text>
          <Text bold color={theme.fgMuted}>Breakdown</Text>
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
