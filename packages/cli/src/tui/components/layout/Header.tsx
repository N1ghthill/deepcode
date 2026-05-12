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
  const statusIndicator = providerStatus
    ? providerStatus.online
      ? { symbol: "●", color: theme.success }
      : { symbol: "○", color: theme.error }
    : { symbol: "○", color: theme.fgMuted };
  const activeTarget = model ? `${provider}/${model}` : `${provider}/${t("notConfigured")}`;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderColor={theme.border}
    >
      <Box>
        <Text bold color={theme.primary}>
          DeepCode
        </Text>
        <Text color={theme.fgMuted}> v2.0</Text>
      </Box>

      <Box gap={2}>
        <Box>
          <Text color={theme.fgMuted}>{t("sidebarTarget")}</Text>
          <Text color={statusIndicator.color}>
            {statusIndicator.symbol}{" "}
          </Text>
          <Text bold color={theme.primary}>
            {activeTarget}
          </Text>
        </Box>

        <Box>
          <Text color={theme.fgMuted}>{t("headerMode")}</Text>
          <Text
            bold
            backgroundColor={agentMode === "build" ? theme.success : theme.primary}
            color={agentMode === "build" ? "black" : "black"}
          >
            {agentMode === "build" ? t("headerBuild") : t("headerPlan")}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
