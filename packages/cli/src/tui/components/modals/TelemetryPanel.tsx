import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { SessionStats } from "@deepcode/core";

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
          Telemetria
        </Text>
        <Text color={theme.fgMuted}>
          Nenhuma estatística disponível para esta sessão.
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
        Telemetria da Sessão
      </Text>
      <Text color={theme.fgMuted}>
        Esc para fechar{hasHistory ? " | ← → navegar" : ""} | E para exportar
      </Text>

      {hasHistory && (
        <Text color={theme.fgMuted}>
          Sessão {navigateIndex + 1}/{allSessions.length}
        </Text>
      )}

      <Text> </Text>

      <Box flexDirection="column">
        <Text bold>Resumo</Text>
        <Text color={theme.fgMuted}>
          Sessão: {displayStats.sessionId.slice(0, 12)}...
        </Text>
        <Text color={theme.fgMuted}>
          Provider: {displayStats.provider}
        </Text>
        <Text color={theme.fgMuted}>
          Modelo: {displayStats.model || "não configurado"}
        </Text>
        <Text color={theme.fgMuted}>
          Duração: {formatDuration(displayStats.duration)}
        </Text>
        <Text> </Text>

        <Text bold>Uso de Tokens</Text>
        <Text color={theme.accent}>
          Input:  {formatTokens(displayStats.inputTokens)} tokens
        </Text>
        <Text color={theme.accent}>
          Output: {formatTokens(displayStats.outputTokens)} tokens
        </Text>
        <Text color={theme.accent}>
          Total:  {formatTokens(displayStats.inputTokens + displayStats.outputTokens)} tokens
        </Text>
        <Text> </Text>

        <Text bold>Custo Estimado</Text>
        <Text color={theme.success} bold>
          ${(displayStats.estimatedCost ?? 0).toFixed(4)}
        </Text>
        <Text> </Text>

        <Text bold>Tool Calls</Text>
        <Text color={theme.fgMuted}>
          Total: {displayStats.toolCalls}
        </Text>
        {displayStats.errorCount > 0 && (
          <>
            <Text> </Text>
            <Text bold color={theme.error}>Erros</Text>
            <Text color={theme.error}>
              Total: {displayStats.errorCount}
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
        * Custo estimado baseado no pricing do modelo
      </Text>

      <Text> </Text>
      <Text bold>Exportação</Text>
      {exportStatus === 'exporting' ? (
        <Text color={theme.warning}>Exportando...</Text>
      ) : exportStatus === 'success' ? (
        <Text color={theme.success}>Exportado para: {lastExportPath}</Text>
      ) : exportStatus === 'error' ? (
        <Text color={theme.error}>Erro ao exportar</Text>
      ) : (
        <Text color={theme.fgMuted}>Pressione E para exportar JSON</Text>
      )}
    </Box>
  );
}
