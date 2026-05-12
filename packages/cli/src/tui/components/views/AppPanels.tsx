import React from "react";
import { Box, Text } from "ink";
import {
  collectSecretValues,
  redactSecrets,
  redactText,
  type ApprovalRequest,
  type TaskPlan,
} from "@deepcode/core";
import {
  resolveConfiguredModelForProvider,
  resolveUsableProviderTarget,
  type ProviderId,
  type Session,
} from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../../runtime.js";
import type { ThemeColors } from "../../themes.js";
import { themeNames } from "../../themes.js";
import { formatModelSelection } from "../../model-selection.js";
import { resolveEffectiveModeSelection } from "../../mode-routing.js";
import {
  CONFIG_FIELDS,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type GithubOAuthState,
  type SlashCommandDef,
} from "../../app-config.js";
import { getConfigValue, serializeConfigDisplayValue } from "../../app-utils.js";
import { DiffPreview } from "../shared/DiffPreview.js";
import { CommandPreview } from "../shared/CommandPreview.js";
import { t } from "../../i18n/index.js";
import { formatAgentStatus } from "../../utils/status-format.js";

export function

 ChatApprovalIndicator({
  request,
  theme,
}: {
  request: ApprovalRequest;
  theme: ThemeColors;
}) {
  const riskColor = request.level === "dangerous" ? theme.error : request.level === "shell" ? theme.warning : theme.accent;
  const operation = request.preview?.type === "shell_command" ? request.preview.command : request.operation;

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1} gap={1}>
      <Box flexDirection="row" alignItems="center">
        <Text color={riskColor} bold>⚠ </Text>
        <Text color={riskColor} bold>[{request.level.toUpperCase()}] </Text>
        <Text>{t("approvalRequired")}</Text>
        <Text color={theme.fgMuted}>{(operation ?? "").length > 50 ? (operation ?? "").slice(0, 50) + "..." : (operation ?? "")}</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text backgroundColor={theme.success} bold> {t("approveOnce")} </Text>
        <Text backgroundColor={theme.primary} bold> {t("approveAlways")} </Text>
        <Text backgroundColor={theme.accent} bold> {t("approveSessionKey")} </Text>
        <Text backgroundColor={theme.error} bold> {t("denyKey")} </Text>
      </Box>
    </Box>
  );
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  theme,
}: {
  commands: SlashCommandDef[];
  selectedIndex: number;
  theme: ThemeColors;
}) {
  return (
    <Box width="100%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.borderActive}>
        <Text color={theme.primary} bold>
          {t("commands")}
        </Text>
      {commands.slice(0, 8).map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <Box key={item.command} flexDirection="column">
            <Text color={selected ? theme.primary : undefined} bold={selected}>
              {selected ? "> " : "  "}
              {truncate(item.label, 22)} <Text color={theme.fgMuted}>{item.command}</Text>
            </Text>
            <Text color={selected ? theme.warning : theme.fgMuted}>
              {"  "}
              {truncate(item.description, 78)}
            </Text>
          </Box>
        );
      })}
      <Text color={theme.fgMuted}>{t("commandBarHint")}</Text>
    </Box>
  );
}

export function GithubOAuthPanel({
  state,
  theme,
}: {
  state: GithubOAuthState;
  theme: ThemeColors;
}) {
  const statusColor =
    state.status === "success"
      ? theme.success
      : state.status === "error" || state.status === "cancelled"
        ? theme.error
        : theme.warning;

  return (
    <Box width="65%" flexDirection="column" borderStyle="double" paddingX={1} borderColor={theme.borderActive}>
        <Text color={statusColor} bold>
          {t("appPanelsGithubOAuthLabel")}{state.status}
        </Text>
      {state.message && <Text>{state.message}</Text>}
      {state.verificationUri && (
        <>
          <Text>{t("url")}</Text>
          <Text color={theme.primary}>{state.verificationUri}</Text>
        </>
      )}
      {state.userCode && (
        <>
          <Text>{t("code")}</Text>
          <Text color={theme.warning} bold>{state.userCode}</Text>
        </>
      )}
      {state.expiresAt && <Text color={theme.fgMuted}>{t("expires", { time: state.expiresAt })}</Text>}
      {state.browserError && (
        <Text color={theme.warning}>{t("browserError", { error: truncate(state.browserError, 160) })}</Text>
      )}
      {(state.status === "opening" || state.status === "waiting") && (
        <Text color={theme.fgMuted}>{t("ctrlCCancelCopy")}</Text>
      )}
    </Box>
  );
}

export function ApprovalPanel({
  request,
  runtime,
  queueLength,
  theme,
}: {
  request: ApprovalRequest;
  runtime: DeepCodeRuntime;
  queueLength: number;
  theme: ThemeColors;
}) {
  const secretValues = collectSecretValues(runtime.config);
  const operation = redactText(request.operation, secretValues);
  const requestPath = request.path ? redactText(request.path, secretValues) : undefined;
  const details = formatApprovalDetails(request.details, secretValues);
  const hasDiff = request.diff && request.diff.before && request.diff.after;
  const hasCommandPreview = request.preview?.type === "shell_command" && request.preview.command;

  const riskColor = request.level === "dangerous" ? theme.error : request.level === "shell" ? theme.warning : theme.accent;

  return (
    <Box width="65%" flexDirection="column" borderStyle="double" paddingX={1} borderColor={riskColor}>
      <Box flexDirection="row" alignItems="center">
        <Text color={riskColor} bold>
          ⚠ {t("approvalRequiredTitle")}
        </Text>
        <Text> </Text>
        <Text color={riskColor} bold>[{request.level.toUpperCase()}]</Text>
        {queueLength > 1 && (
          <Text color={theme.fgMuted}> ({t("countInQueue", { count: queueLength })})</Text>
        )}
      </Box>

      {hasCommandPreview && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.fgMuted} bold>{t("commandLabel")}</Text>
          <CommandPreview
            theme={theme}
            command={request.preview!.command || ""}
            args={request.preview!.args || []}
            workingDir={requestPath}
            estimatedRisk={request.level === "dangerous" ? "high" : request.level === "shell" ? "medium" : "low"}
          />
        </Box>
      )}

      {hasDiff && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.fgMuted} bold>{t("diffLabel")}</Text>
          <DiffPreview
            theme={theme}
            before={request.diff!.before}
            after={request.diff!.after}
            filePath={request.diff!.filePath}
          />
        </Box>
      )}

      {(!hasCommandPreview || details.length > 0) && (
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.fgMuted} bold>{t("operationLabel")}</Text>
          <Text color={theme.primary}>{truncate(operation, 900)}</Text>
          {requestPath && (
            <>
              <Text>{t("pathLabel")}</Text>
              <Text color={theme.fgMuted}>{truncate(requestPath, 900)}</Text>
            </>
          )}
          {details.length > 0 && (
            <>
              <Text> </Text>
              <Text color={theme.fgMuted} bold>{t("detailsLabel")}</Text>
              {details.map((line, i) => (
                <Text key={i} color={theme.fgMuted}>
                  {truncate(line, 120)}
                </Text>
              ))}
            </>
          )}
        </Box>
      )}

      <Box flexDirection="row" marginTop={1} gap={2}>
        <Text backgroundColor={theme.success}> {t("approveOnce")} </Text>
        <Text backgroundColor={theme.primary}> {t("approveAlways")} </Text>
        <Text backgroundColor={theme.accent}> {t("approveSessionKey")} </Text>
        <Text backgroundColor={theme.error}> {t("denyKey")} </Text>
        <Text dimColor> {t("appPanelsEscDeny")} </Text>
      </Box>
      <Text dimColor>{t("requested", { time: formatSessionTime(request.createdAt) })}</Text>
    </Box>
  );
}

export function SessionSwitcher({
  sessions,
  selectedIndex,
  activeId,
  theme,
}: {
  sessions: Session[];
  selectedIndex: number;
  activeId: string;
  theme: ThemeColors;
}) {
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Text bold>{t("sessions")}</Text>
      {sessions.length === 0 && <Text color={theme.fgMuted}>{t("noSavedSessions")}</Text>}
      {sessions.slice(0, 12).map((item, index) => {
        const selected = index === selectedIndex;
        const active = item.id === activeId;
        return (
          <Text key={item.id} color={selected ? theme.primary : active ? theme.success : undefined}>
            {selected ? "> " : "  "}
            {item.id} {active ? "*" : " "} {item.status} {item.messages.length} {t("appPanelsMsgs")}{" "}
            {formatSessionTime(item.updatedAt)}
          </Text>
        );
      })}
    </Box>
  );
}

export function ConfigEditor({
  runtime,
  selectedIndex,
  editing,
  editValue,
  saveStatus,
  theme,
}: {
  runtime: DeepCodeRuntime;
  selectedIndex: number;
  editing: boolean;
  editValue: string;
  saveStatus: string | null;
  theme: ThemeColors;
}) {
  const config = redactSecrets(runtime.config, {
    secretPlaceholder: t("appPanelsSet"),
    emptySecretPlaceholder: t("appPanelsEmpty"),
  }) as Record<string, unknown>;
  const providers = runtime.config.providers;
  const configuredModels = PROVIDER_IDS.map((providerId) => ({
    providerId,
    label: PROVIDER_LABELS[providerId],
    model: runtime.config.defaultModels?.[providerId],
    isDefault: runtime.config.defaultProvider === providerId,
  }));
  const baseTarget = resolveUsableProviderTarget(runtime.config, [runtime.config.defaultProvider]);
  const baseSession = {
    provider: baseTarget.provider,
    model: baseTarget.model,
  };
  const planSelection = resolveEffectiveModeSelection(runtime.config, baseSession, "plan");
  const buildSelection = resolveEffectiveModeSelection(runtime.config, baseSession, "build");

  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Text bold>{t("configEditable")}</Text>
      <Text color={theme.fgMuted}>{t("defaultProvider", { provider: String(config.defaultProvider) })}</Text>
      <Text color={theme.fgMuted}>
        {t("activeModel", { model: String(resolveConfiguredModelForProvider(runtime.config, runtime.config.defaultProvider) ?? t("notConfigured")) })}
      </Text>
      <Text color={theme.fgMuted}>{t("appPanelsPlanMode")}{planSelection ? formatModelSelection(planSelection) : t("notConfigured")}</Text>
      <Text color={theme.fgMuted}>{t("appPanelsBuildMode")}{buildSelection ? formatModelSelection(buildSelection) : t("notConfigured")}</Text>
      <Text> </Text>
      <Text bold>{t("modelsByProvider")}</Text>
      {configuredModels.map(({ providerId, label, model, isDefault }) => (
        <Text key={providerId} color={isDefault ? theme.warning : theme.fgMuted}>
          {label}: {model && model.trim().length > 0 ? model : "\u2014"}
          {isDefault ? ` | ${t("defaultProviderLabel")}` : ""}
        </Text>
      ))}
      <Text> </Text>
      <Text bold>{t("editableFields")}</Text>
      {CONFIG_FIELDS.map((field, index) => {
        const selected = index === selectedIndex;
        const currentValue = getConfigValue(runtime.config, field.key);
        const isApiKey = field.key.endsWith(".apiKey");
        const displayValue =
          field.type === "toggle"
            ? currentValue
              ? t("appPanelsEnabled")
              : t("appPanelsDisabled")
            : isApiKey
              ? currentValue
                ? t("appPanelsSet")
                : t("appPanelsEmpty")
              : serializeConfigDisplayValue(currentValue);

        return (
          <Box key={field.key}>
            <Text color={selected ? theme.primary : undefined}>
              {selected ? "> " : "  "}
              {field.label}:{" "}
            </Text>
            {editing && selected ? (
              <Text color={theme.warning}>{editValue}_</Text>
            ) : (
              <Text color={selected ? theme.warning : theme.success}>{displayValue}</Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      {saveStatus && (
        <Text color={saveStatus.startsWith(t("configError")) ? theme.error : theme.success}>{saveStatus}</Text>
      )}
      <Text color={theme.fgMuted}>
        {editing ? t("enterSavesEscCancels") : t("enterEditNavigateEscBack")}
      </Text>
      <Text color={theme.fgMuted}>{t("jsonFieldsHint")}</Text>
      <Text> </Text>
      <Text bold>{t("providers")}</Text>
      {Object.entries(providers).map(([name, provider]) => (
        <Text key={name} color={provider.apiKey ? theme.success : theme.fgMuted}>
          {PROVIDER_LABELS[name as ProviderId] ?? name}: {provider.apiKey ? t("appPanelsApiKeySet") : t("appPanelsApiKeyMissing")}
          {provider.baseUrl ? ` | ${provider.baseUrl}` : ""}
        </Text>
      ))}
      <Text>{runtime.config.github.token ? t("appPanelsGithubTokenSet") : t("appPanelsGithubTokenMissing")}</Text>
    </Box>
  );
}

export function HelpView({ theme }: { theme: ThemeColors }) {
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Text bold>{t("help")}</Text>
      <Text> </Text>
      <Text bold>{t("commands")}</Text>
      <Text>{t("helpCommand")}</Text>
      <Text>{t("clearCommand")}</Text>
      <Text>{t("newCommand")}</Text>
      <Text>{t("sessionsCommand")}</Text>
      <Text>{t("configCommand")}</Text>
      <Text> </Text>
      <Text bold>{t("generalShortcuts")}</Text>
      <Text>{t("ctrlShortcuts")}</Text>
      <Text>{t("ctrlHelpTelemetry")}</Text>
      <Text>{t("numberTabs")}</Text>
      <Text> </Text>
      <Text bold>{t("vimBindingsChat")}</Text>
      <Text>{t("vimInsertMode")}</Text>
      <Text> </Text>
      <Text bold>{t("vimBindingsConfig")}</Text>
      <Text>{t("vimConfigNav")}</Text>
      <Text> </Text>
      <Text bold>{t("approvals")}</Text>
      <Text>{t("approvalKeys")}</Text>
      <Text> </Text>
      <Text bold>{t("availableThemes")}</Text>
      <Text>{themeNames.join(", ")}</Text>
      <Text>{t("changeThemeHint")}</Text>
    </Box>
  );
}

export function EmptyChatState({
  theme,
  session,
  status,
  activeTarget,
  planSelection,
  buildSelection,
  approvalCount,
}: {
  theme: ThemeColors;
  session: Session;
  status: string;
  activeTarget?: string;
  planSelection: ReturnType<typeof resolveEffectiveModeSelection>;
  buildSelection: ReturnType<typeof resolveEffectiveModeSelection>;
  approvalCount: number;
}) {
  return (
    <Box flexDirection="column">
      <Text color={theme.fgMuted}>
        {t("noMessagesYet")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("activeTarget")} {activeTarget ?? t("notConfigured")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("statusLabel")} {formatAgentStatus(status)}
      </Text>
      <Text color={theme.fgMuted}>
        {t("appPanelsPlanMode")}{planSelection ? formatModelSelection(planSelection) : t("notConfigured")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("appPanelsBuildMode")}{buildSelection ? formatModelSelection(buildSelection) : t("notConfigured")}
      </Text>
      <Text color={theme.fgMuted}>
        {t("pendingApprovals", { count: approvalCount })}
      </Text>
      <Text> </Text>
      <Text color={theme.primary}>{t("usefulShortcuts")}</Text>
      <Text color={theme.fgMuted}>{t("appPanelsShortcutsHint")}</Text>
      <Text color={theme.fgMuted}>{t("emptyChatSlashHint")}</Text>
      <Text> </Text>
      <Text color={theme.primary}>{t("sessionLabel")}</Text>
      <Text color={theme.fgMuted}>{t("appPanelsIdLabel")}{session.id}</Text>
      <Text color={theme.fgMuted}>{t("appPanelsCreatedLabel")}{formatSessionTime(session.createdAt)}</Text>
      <Text color={theme.fgMuted}>{t("appPanelsUpdatedLabel")}{formatSessionTime(session.updatedAt)}</Text>
    </Box>
  );
}

export function PlanProgressBar({ plan, theme }: { plan: TaskPlan; theme: ThemeColors }) {
  const total = plan.tasks.length;
  const completed = plan.tasks.filter((task) => task.status === "completed").length;
  const failed = plan.tasks.filter((task) => task.status === "failed").length;
  const running = plan.tasks.filter((task) => task.status === "running").length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const currentTask = plan.tasks.find((task) => task.status === "running");

  const barWidth = 20;
  const filled = Math.round((completed / Math.max(total, 1)) * barWidth);
  const failedChars = Math.round((failed / Math.max(total, 1)) * barWidth);
  let bar = "";
  for (let index = 0; index < barWidth; index += 1) {
    if (index < filled - failedChars) bar += "█";
    else if (index < filled) bar += "✗";
    else if (index === filled && running > 0) bar += "▌";
    else bar += "░";
  }

  return (
    <Box paddingX={1} flexDirection="column">
      <Text color={theme.accent}>
        [{bar}] {completed + running}/{total} ({percentage}%)
      </Text>
      {currentTask && (
        <Text color={theme.fgMuted}>
          ⟳ {truncate(currentTask.description, 60)}
        </Text>
      )}
    </Box>
  );
}



import { truncate } from "../../utils/truncate.js";

function formatApprovalDetails(
  details: Record<string, unknown> | undefined,
  secretValues: string[],
): string[] {
  if (!details) return [];
  const redacted = redactSecrets(details, { secretValues });
  if (!redacted || typeof redacted !== "object" || Array.isArray(redacted)) return [];
  return Object.entries(redacted)
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
