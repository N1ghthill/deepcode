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
import { InlineSpinner } from "../shared/InlineSpinner.js";

export interface StatusBarProps {
  theme: ThemeColors;
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
  const visibleNotice = notice ? truncateMiddle(notice.replace(/\s+/g, " "), 110) : undefined;
  const planTarget = formatRouteTarget(planSelection);
  const buildTarget = formatRouteTarget(buildSelection);

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="round"
        borderColor={streaming ? theme.borderActive : theme.border}
      >
        {streaming ? (
          <StreamingLine
            theme={theme}
            phase={phase}
            toolExecuting={toolExecuting}
            iteration={iteration}
            elapsed={elapsed}
          />
        ) : vimMode === "normal" ? (
          <Box flexDirection="row" gap={1}>
            <Text backgroundColor={theme.warning} color="black" bold>
              {" NORMAL "}
            </Text>
            <Text color={theme.fgMuted}>{t("statusBarNormalMode")}</Text>
          </Box>
        ) : null}

        <Box gap={2} flexWrap="wrap">
          <Box flexDirection="row" gap={1}>
            <Text color={theme.fgMuted} dimColor>
              ●
            </Text>
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
          </Box>

          <Box flexDirection="row" gap={1}>
            <Text color={theme.fgMuted} dimColor>
              ↑
            </Text>
            <Text color={theme.accent}>{formatTokens(inputTokens)}</Text>
            <Text color={theme.fgMuted} dimColor>
              ↓
            </Text>
            <Text color={theme.accent}>{formatTokens(outputTokens)}</Text>
          </Box>

          <Box flexDirection="row" gap={1}>
            <Text color={theme.fgMuted} dimColor>
              $
            </Text>
            <Text color={theme.success}>{formatCost(estimatedCost)}</Text>
          </Box>

          <Box flexDirection="row" gap={1}>
            <Text color={theme.fgMuted} dimColor>
              ⚡
            </Text>
            <Text color={theme.fg}>{toolCalls}</Text>
          </Box>

          {errorCount > 0 && (
            <Box flexDirection="row" gap={1}>
              <Text color={theme.error} bold>
                ✗ {errorCount}
              </Text>
            </Box>
          )}
        </Box>

        <Box gap={2}>
          <ModeRoute
            active={agentMode === "plan"}
            label={t("statusBarPlanLabel")}
            target={planTarget}
            theme={theme}
          />
          <Text color={theme.fgMuted} dimColor>
            │
          </Text>
          <ModeRoute
            active={agentMode === "build"}
            label={t("statusBarBuildLabel")}
            target={buildTarget}
            theme={theme}
          />
        </Box>
      </Box>

      {visibleNotice && (
        <Box paddingX={1}>
          <Text color={theme.accent} dimColor>
            ›
          </Text>
          <Text color={theme.fgMuted}> {visibleNotice}</Text>
        </Box>
      )}
    </Box>
  );
}

function StreamingLine({
  theme,
  phase,
  toolExecuting,
  iteration,
  elapsed,
}: {
  theme: ThemeColors;
  phase: string;
  toolExecuting: boolean;
  iteration: { current: number; max: number };
  elapsed: number;
}) {
  const label =
    phase === "planning"
      ? t("statusBarPlanning")
      : phase.startsWith("task")
      ? `⚡ ${phase}`
      : toolExecuting
      ? t("statusBarExecutingTools")
      : t("statusBarGenerating");

  return (
    <Box flexDirection="row" gap={1}>
      <InlineSpinner theme={theme} />
      <Text color={theme.warning} bold>
        {label}
      </Text>
      {iteration.max > 0 && (
        <Text color={theme.fgMuted}>
          [{iteration.current}/{iteration.max}]
        </Text>
      )}
      {elapsed > 0 && (
        <Text color={theme.fgMuted}>
          · {formatElapsed(elapsed)}
        </Text>
      )}
      <Text color={theme.fgMuted} dimColor>
        · {t("statusBarCtrlCCancel")}
      </Text>
    </Box>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
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
    <Box flexDirection="row">
      <Text
        bold
        backgroundColor={active ? badgeColor : undefined}
        color={active ? "black" : theme.fgMuted}
      >
        {active ? ` ● ${label} ` : `   ${label}  `}
      </Text>
      <Text color={active ? theme.fg : theme.fgMuted} dimColor={!active}>
        {" "}{target}
      </Text>
    </Box>
  );
}
