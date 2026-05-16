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

export function ChatApprovalIndicator({
  request,
  theme,
}: {
  request: ApprovalRequest;
  theme: ThemeColors;
}) {
  const riskColor =
    request.level === "dangerous"
      ? theme.error
      : request.level === "shell"
        ? theme.warning
        : theme.accent;
  const operation =
    request.preview?.type === "shell_command" ? request.preview.command : request.operation;
  const opText = (operation ?? "").length > 60 ? (operation ?? "").slice(0, 60) + "..." : operation ?? "";

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      marginTop={1}
      gap={1}
      borderStyle="round"
      borderColor={riskColor}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={riskColor} bold>
          ⚠
        </Text>
        <Text backgroundColor={riskColor} color="black" bold>
          {" "}{request.level.toUpperCase()}{" "}
        </Text>
        <Text color={theme.fg} bold>
          {t("approvalRequired")}
        </Text>
      </Box>
      {opText && (
        <Box paddingLeft={2}>
          <Text color={theme.fgMuted}>{opText}</Text>
        </Box>
      )}
      <Box flexDirection="row" gap={1}>
        <Text backgroundColor={theme.success} color="black" bold>
          {" "}{t("approveOnce")}{" "}
        </Text>
        <Text backgroundColor={theme.primary} color="black" bold>
          {" "}{t("approveAlways")}{" "}
        </Text>
        <Text backgroundColor={theme.accent} color="black" bold>
          {" "}{t("approveSessionKey")}{" "}
        </Text>
        <Text backgroundColor={theme.error} color="black" bold>
          {" "}{t("denyKey")}{" "}
        </Text>
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
  const visible = commands.slice(0, 6);
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      paddingX={1}
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.accent} bold>
          ◆
        </Text>
        <Text color={theme.fgMuted} dimColor>
          {commands.length > 6
            ? `comandos · ${visible.length}/${commands.length}`
            : `comandos · ${visible.length}`}
        </Text>
      </Box>
      {visible.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <Box key={item.command} flexDirection="row" gap={1}>
            <Text color={selected ? theme.primary : theme.fgMuted}>
              {selected ? "▸" : " "}
            </Text>
            <Text
              bold={selected}
              color={selected ? theme.primary : theme.fg}
            >
              {item.command.padEnd(16)}
            </Text>
            <Text color={selected ? theme.fg : theme.fgMuted} dimColor={!selected}>
              {truncate(item.description, 55)}
            </Text>
          </Box>
        );
      })}
      <Box flexDirection="row" gap={1} marginTop={0}>
        <Text color={theme.fgMuted} dimColor>
          ↑↓
        </Text>
        <Text color={theme.fgMuted} dimColor>
          navegar ·
        </Text>
        <Text color={theme.accent}>Tab</Text>
        <Text color={theme.fgMuted} dimColor>
          completar ·
        </Text>
        <Text color={theme.success}>Enter</Text>
        <Text color={theme.fgMuted} dimColor>
          executar ·
        </Text>
        <Text color={theme.error}>Esc</Text>
        <Text color={theme.fgMuted} dimColor>
          fechar
        </Text>
      </Box>
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

const CMD_W = 20;

function HelpRow({ keys, desc, theme, accent = false }: { keys: string; desc: string; theme: ThemeColors; accent?: boolean }) {
  return (
    <Box flexDirection="row">
      <Box width={CMD_W} flexShrink={0}>
        <Text color={accent ? theme.accent : theme.primary} bold={accent}>{keys}</Text>
      </Box>
      <Text color={theme.fgMuted}>{desc}</Text>
    </Box>
  );
}

function HelpSection({ label, theme }: { label: string; theme: ThemeColors }) {
  return (
    <Box flexDirection="row" gap={1} marginTop={1}>
      <Text color={theme.accent} bold>▌</Text>
      <Text color={theme.fg} bold>{label}</Text>
    </Box>
  );
}

export function HelpView({ theme }: { theme: ThemeColors }) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.primary} bold>◆</Text>
        <Text color={theme.fg} bold>Ajuda — DeepCode</Text>
        <Text color={theme.fgMuted} dimColor>  Esc · Enter · q para fechar</Text>
      </Box>

      <HelpSection label="COMANDOS SLASH" theme={theme} />
      <HelpRow keys="/help"          desc="Abre esta ajuda"                               theme={theme} />
      <HelpRow keys="/provider"      desc="Configura provider e API key"                  theme={theme} />
      <HelpRow keys="/model"         desc="Seleciona modelo ativo"                        theme={theme} />
      <HelpRow keys="/mode plan"     desc="Modo PLAN — analisa sem editar arquivos"       theme={theme} />
      <HelpRow keys="/mode build"    desc="Modo BUILD — edita, executa e valida"          theme={theme} />
      <HelpRow keys="/config"        desc="Abre editor de configuração"                   theme={theme} />
      <HelpRow keys="/sessions"      desc="Lista e troca entre sessões salvas"            theme={theme} />
      <HelpRow keys="/new"           desc="Cria uma sessão nova"                          theme={theme} />
      <HelpRow keys="/clear"         desc="Limpa o chat sem apagar a sessão"              theme={theme} />
      <HelpRow keys="/undo"          desc="Reverte a última alteração de arquivo"         theme={theme} />
      <HelpRow keys="/diff"          desc="Mostra resumo de todas as alterações pendentes" theme={theme} />
      <HelpRow keys="/timeline"      desc="Linha do tempo de ações da sessão"             theme={theme} />
      <HelpRow keys="/github-login"  desc="Autenticar GitHub via OAuth"                  theme={theme} />

      <HelpSection label="ATALHOS GLOBAIS" theme={theme} />
      <HelpRow keys="Ctrl+C"     desc="Cancelar execução em curso · Ctrl+Q para sair"  theme={theme} accent />
      <HelpRow keys="Ctrl+H"     desc="Abrir esta ajuda"                               theme={theme} accent />
      <HelpRow keys="Ctrl+O"     desc="Seletor de sessões"                             theme={theme} accent />
      <HelpRow keys="Ctrl+N"     desc="Nova sessão"                                    theme={theme} accent />
      <HelpRow keys="Ctrl+P"     desc="Modal de provider"                              theme={theme} accent />
      <HelpRow keys="Ctrl+M"     desc="Seletor de modelo"                              theme={theme} accent />
      <HelpRow keys="Ctrl+T"     desc="Painel de telemetria"                           theme={theme} accent />
      <HelpRow keys="Ctrl+R"     desc="Buscar no histórico de prompts"                 theme={theme} accent />
      <HelpRow keys="Tab"        desc="Alternar entre modos PLAN ↔ BUILD"              theme={theme} accent />

      <HelpSection label="PAINÉIS  (L=esquerdo  C=central  D=direito)" theme={theme} />
      <HelpRow keys="Ctrl+1/2/3"   desc="Fechar/abrir painel L / C / D"               theme={theme} accent />
      <HelpRow keys="Ctrl+B"       desc="Toggle sidebar (painel L)"                    theme={theme} accent />
      <HelpRow keys="Ctrl+F"       desc="Alternar sidebar ↔ árvore de arquivos"        theme={theme} accent />
      <HelpRow keys="Ctrl+L"       desc="Toggle timeline no painel D"                  theme={theme} accent />
      <HelpRow keys="Ctrl+,"       desc="Toggle configuração no painel D"              theme={theme} accent />
      <HelpRow keys="Ctrl+←/→"    desc="Redimensionar painel ativo"                   theme={theme} accent />

      <HelpSection label="SCROLL DO CHAT" theme={theme} />
      <HelpRow keys="PgUp / PgDn"    desc="Rolar para cima/baixo"                      theme={theme} />
      <HelpRow keys="Ctrl+↑ / Ctrl+↓" desc="Rolar para cima/baixo (alternativo)"       theme={theme} />
      <HelpRow keys="Esc → j / k"    desc="Vim normal mode: j baixo · k cima"          theme={theme} />
      <HelpRow keys="Esc → G / gg"   desc="Ir ao fim / topo da conversa"               theme={theme} />
      <HelpRow keys="Esc → Ctrl+D/U" desc="Meio-página para baixo / cima"              theme={theme} />

      <HelpSection label="VIM  (Esc = insert→normal · i = normal→insert)" theme={theme} />
      <HelpRow keys="i / a / A"   desc="Insert: na pos / após cursor / no fim"         theme={theme} />
      <HelpRow keys="I / S"       desc="Insert: no início / limpar tudo + insert"      theme={theme} />
      <HelpRow keys="h / l"       desc="Mover cursor ← / →"                            theme={theme} />
      <HelpRow keys="w / b / e"   desc="Palavra: próxima / anterior / fim"             theme={theme} />
      <HelpRow keys="0 / $ / ^"   desc="Início / fim / 1º char não-vazio da linha"     theme={theme} />
      <HelpRow keys="x / X"       desc="Deletar char sob cursor / à esquerda"          theme={theme} />
      <HelpRow keys="D / C"       desc="Deletar / mudar até o fim da linha"            theme={theme} />
      <HelpRow keys="dd / dw"     desc="Deletar linha inteira / palavra"               theme={theme} />
      <HelpRow keys="cc / cw / cb" desc="Mudar linha / palavra / trás"                 theme={theme} />
      <HelpRow keys="r<c>"        desc="Substituir o char sob o cursor"                theme={theme} />

      <HelpSection label="APROVAÇÕES  (quando o agente pede permissão)" theme={theme} />
      <HelpRow keys="a"     desc="Aprovar uma vez"                                     theme={theme} />
      <HelpRow keys="l"     desc="Aprovar sempre (adicionar ao allow-list)"            theme={theme} />
      <HelpRow keys="s"     desc="Aprovar nesta sessão"                                theme={theme} />
      <HelpRow keys="d / n / Esc" desc="Negar"                                         theme={theme} />

      <HelpSection label="TEMAS" theme={theme} />
      <Box paddingLeft={2} marginBottom={1}>
        <Text color={theme.fgMuted}>{themeNames.join("  ·  ")}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={theme.fgMuted} dimColor>Alterar: /config → tui.theme</Text>
      </Box>
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
  const planLabel = planSelection ? formatModelSelection(planSelection) : t("notConfigured");
  const buildLabel = buildSelection ? formatModelSelection(buildSelection) : t("notConfigured");

  return (
    <Box flexDirection="column" paddingY={1} paddingX={2} flexGrow={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.primary} bold>
          ◆ DeepCode
        </Text>
        <Text color={theme.fgMuted} dimColor>
          Agente de código local · pronto pra trabalhar
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <InfoRow theme={theme} icon="◉" label={t("activeTarget")} value={activeTarget ?? t("notConfigured")} />
        <InfoRow theme={theme} icon="●" label={t("statusLabel")} value={formatAgentStatus(status)} valueColor={status === "error" ? theme.error : theme.success} />
        <InfoRow theme={theme} icon="◆" label="PLAN " value={planLabel} valueColor={theme.primary} />
        <InfoRow theme={theme} icon="◆" label="BUILD" value={buildLabel} valueColor={theme.success} />
        {approvalCount > 0 && (
          <InfoRow theme={theme} icon="⚠" label="Aprovações" value={String(approvalCount)} valueColor={theme.warning} />
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color={theme.accent} bold>
          ▌ {t("usefulShortcuts")}
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <ShortcutHint theme={theme} keys="/" desc="comandos rápidos" />
          <ShortcutHint theme={theme} keys="Tab" desc="alternar Plan/Build" />
          <ShortcutHint theme={theme} keys="Ctrl+O" desc="trocar de sessão" />
          <ShortcutHint theme={theme} keys="Ctrl+H" desc="ajuda completa" />
        </Box>
      </Box>

      <Box flexDirection="column">
        <Text color={theme.fgMuted} dimColor>
          {t("sessionLabel")} {session.id.slice(0, 8)} · {formatSessionTime(session.updatedAt)}
        </Text>
      </Box>
    </Box>
  );
}

function InfoRow({
  theme,
  icon,
  label,
  value,
  valueColor,
}: {
  theme: ThemeColors;
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={theme.fgMuted}>{icon}</Text>
      <Text color={theme.fgMuted}>{label}</Text>
      <Text color={valueColor ?? theme.fg} bold>
        {value}
      </Text>
    </Box>
  );
}

function ShortcutHint({
  theme,
  keys,
  desc,
}: {
  theme: ThemeColors;
  keys: string;
  desc: string;
}) {
  return (
    <Box flexDirection="row" gap={1}>
      <Text backgroundColor={theme.bgTertiary} color={theme.accent} bold>
        {" "}{keys}{" "}
      </Text>
      <Text color={theme.fgMuted}>{desc}</Text>
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
