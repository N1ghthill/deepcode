import React from "react";
import { Box, Text } from "ink";
import type { AgentMode } from "@deepcode/shared";
import type { ThemeColors } from "../../themes.js";
import {
  formatModelSelection,
  type ModelSelection,
} from "../../model-selection.js";
import { t } from "../../i18n/index.js";
import { formatAgentStatus } from "../../utils/status-format.js";

export interface StatusBarProps {
  theme: ThemeColors;
  input: string;
  streaming: boolean;
  status: string;
  vimMode?: "insert" | "normal";
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  toolCalls: number;
  elapsed?: number;
  toolExecuting?: boolean;
  errorCount?: number;
  phase?: string;
  iteration?: { current: number; max: number };
  notice?: string;
  agentMode?: AgentMode;
  planSelection?: ModelSelection | null;
  buildSelection?: ModelSelection | null;
}

export function StatusBar({
  theme,
  input,
  streaming,
  status,
  vimMode = "insert",
  inputTokens,
  outputTokens,
  estimatedCost,
  toolCalls,
  elapsed = 0,
  toolExecuting = false,
  errorCount = 0,
  phase = "",
  iteration = { current: 0, max: 0 },
  notice,
  agentMode = "build",
  planSelection,
  buildSelection,
}: StatusBarProps) {
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return String(tokens);
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const visibleInput = truncateMiddle(input.replace(/\s+/g, " "), 72);
  const visibleNotice = notice ? truncateMiddle(notice.replace(/\s+/g, " "), 110) : undefined;
  const planTarget = formatRouteTarget(planSelection);
  const buildTarget = formatRouteTarget(buildSelection);

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor={theme.border}
      >
        {streaming ? (
          <Text color={theme.warning}>
            {phase === "planning" ? t("statusBarPlanning") :
             phase.startsWith("task") ? `\u26A1 ${phase}` :
             toolExecuting ? t("statusBarExecutingTools") : t("statusBarGenerating")}
            {iteration.max > 0 && (
              <Text color={theme.fgMuted}> [{iteration.current}/{iteration.max}]</Text>
            )}
            {elapsed > 0 && (
              <Text color={theme.fgMuted}> [{formatElapsed(elapsed)}]</Text>
            )}
            {' '}<Text color={theme.fgMuted}>{t("statusBarCtrlCCancel")}</Text>
          </Text>
        ) : vimMode === "normal" ? (
          <Text color={theme.fgMuted}>
            {t("statusBarNormalMode")}
          </Text>
        ) : (
          <Text>
            {" > "}{visibleInput}_
          </Text>
        )}

        <Box gap={2}>
          <Text color={theme.fgMuted}>
            {t("statusBarStatusLabel")}
            <Text
              bold
              color={
                streaming
                  ? theme.warning
                  : status === "error"
                  ? theme.error
                  : theme.success
              }
            >
              {streaming ? t("statusBarExecuting") : formatAgentStatus(status)}
            </Text>
          </Text>

          <Text color={theme.accent}>
            ↑ {formatTokens(inputTokens)} | ↓ {formatTokens(outputTokens)}
          </Text>

          <Text color={theme.success}>
            {formatCost(estimatedCost)}
          </Text>

          <Text color={theme.fgMuted}>
            ⚡ {toolCalls}
          </Text>

          {errorCount > 0 && (
            <Text color={theme.error}>
              ✗ {errorCount}
            </Text>
          )}
        </Box>

        <Box gap={2}>
          <ModeRoute
            active={agentMode === "plan"}
            label={t("statusBarPlanLabel")}
            target={planTarget}
            theme={theme}
          />
          <Text color={theme.fgMuted}>|</Text>
          <ModeRoute
            active={agentMode === "build"}
            label={t("statusBarBuildLabel")}
            target={buildTarget}
            theme={theme}
          />
        </Box>
      </Box>

      {visibleNotice && (
        <Text color={theme.fgMuted} dimColor>
          {visibleNotice}
        </Text>
      )}
    </Box>
  );
}

function truncateMiddle(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  if (maxLength <= 3) return input.slice(0, maxLength);
  const keep = Math.floor((maxLength - 3) / 2);
  const tail = maxLength - 3 - keep;
  return `${input.slice(0, keep)}...${input.slice(input.length - tail)}`;
}

function formatRouteTarget(selection?: ModelSelection | null): string {
  if (!selection) {
    return t("notConfigured");
  }

  return truncateMiddle(formatModelSelection(selection), 32);
}

function ModeRoute({
  active,
  label,
  target,
  theme,
}: {
  active: boolean;
  label: string;
  target: string;
  theme: ThemeColors;
}) {
  const badgeColor = label === "BUILD" ? theme.success : theme.primary;

  return (
    <Box>
      <Text color={active ? badgeColor : theme.fgMuted}>
        {active ? "●" : "○"}
      </Text>
      <Text
        bold
        backgroundColor={active ? badgeColor : undefined}
        color={active ? "black" : theme.fgMuted}
      >
        {` ${label} `}
      </Text>
      <Text color={active ? theme.fg : theme.fgMuted}>
        {" "}{target}
      </Text>
    </Box>
  );
}
