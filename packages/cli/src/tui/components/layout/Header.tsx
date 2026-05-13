import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";
import type { ProviderStatus } from "../../hooks/useProviderStatus.js";
import type { ProviderId, AgentMode } from "@deepcode/shared";
import { t } from "../../i18n/index.js";

export interface HeaderProps {
  provider: ProviderId;
  model: string;
  agentMode: AgentMode;
  theme: ThemeColors;
  providerStatus?: ProviderStatus;
}

export function Header({
  provider,
  model,
  agentMode,
  theme,
  providerStatus,
}: HeaderProps) {
  const online = providerStatus?.online ?? false;
  const statusColor = providerStatus
    ? online
      ? theme.success
      : theme.error
    : theme.fgMuted;
  const statusSymbol = providerStatus ? (online ? "●" : "○") : "◌";
  const modeColor = agentMode === "build" ? theme.success : theme.primary;

  const modelLabel = model || t("notConfigured");

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="round"
      borderColor={theme.border}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.primary} bold>
          ◆
        </Text>
        <Text color={theme.primary} bold>
          DeepCode
        </Text>
        <Text color={theme.fgMuted} dimColor>
          v2.0
        </Text>
      </Box>

      <Box flexDirection="row" gap={2}>
        <Box flexDirection="row" gap={1}>
          <Text color={statusColor}>{statusSymbol}</Text>
          <Text color={theme.fgMuted}>{provider}</Text>
          <Text color={theme.fgMuted} dimColor>
            ·
          </Text>
          <Text color={theme.fg}>{modelLabel}</Text>
        </Box>

        <Text color={theme.fgMuted}>│</Text>

        <Box flexDirection="row">
          <Text backgroundColor={modeColor} color="black" bold>
            {" "}{agentMode === "build" ? t("headerBuild") : t("headerPlan")}{" "}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
