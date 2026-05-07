import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Activity, Message, Session } from "@deepcode/shared";
import {
  collectSecretValues,
  redactSecrets,
  redactText,
  type ApprovalRequest,
} from "@deepcode/core";
import { createRuntime, type DeepCodeRuntime } from "../runtime.js";
import { getTheme, themeNames, type ThemeColors } from "./themes.js";

export interface AppProps {
  cwd: string;
  config?: string;
}

type ViewMode = "chat" | "sessions" | "config" | "help";
type VimMode = "insert" | "normal";
type ConfigEditField =
  | "defaultProvider"
  | "defaultModel"
  | "providers.openrouter.apiKey"
  | "providers.anthropic.apiKey"
  | "providers.openai.apiKey"
  | "providers.deepseek.apiKey"
  | "providers.opencode.apiKey"
  | "cache.enabled"
  | "cache.ttlSeconds"
  | "permissions.read"
  | "permissions.write"
  | "permissions.shell"
  | "permissions.dangerous"
  | "permissions.gitLocal"
  | "tui.theme"
  | "tui.compactMode";

interface ConfigFieldDef {
  key: ConfigEditField;
  label: string;
  type: "select" | "number" | "toggle" | "text";
  options?: string[];
}

const CONFIG_FIELDS: ConfigFieldDef[] = [
  { key: "defaultProvider", label: "Provider", type: "select", options: ["openrouter", "anthropic", "openai", "deepseek", "opencode"] },
  { key: "defaultModel", label: "Model", type: "text" },
  { key: "providers.openrouter.apiKey", label: "OpenRouter API Key", type: "text" },
  { key: "providers.anthropic.apiKey", label: "Anthropic API Key", type: "text" },
  { key: "providers.openai.apiKey", label: "OpenAI API Key", type: "text" },
  { key: "providers.deepseek.apiKey", label: "DeepSeek API Key", type: "text" },
  { key: "providers.opencode.apiKey", label: "OpenCode API Key", type: "text" },
  { key: "cache.enabled", label: "Cache", type: "toggle" },
  { key: "cache.ttlSeconds", label: "Cache TTL (s)", type: "number" },
  { key: "permissions.read", label: "Read perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.write", label: "Write perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.shell", label: "Shell perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.dangerous", label: "Dangerous perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.gitLocal", label: "Git local perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "tui.theme", label: "Theme", type: "select", options: themeNames },
  { key: "tui.compactMode", label: "Compact mode", type: "toggle" },
];

export function App(props: AppProps) {
  const { exit } = useApp();
  const [runtime, setRuntime] = useState<DeepCodeRuntime | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [status, setStatus] = useState("loading");
  const [notice, setNotice] = useState("Ctrl+Q sai. Ctrl+H ajuda. Ctrl+O sessões. Enter envia.");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [configEditIndex, setConfigEditIndex] = useState(0);
  const [configEditValue, setConfigEditValue] = useState("");
  const [editingConfig, setEditingConfig] = useState(false);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ id: string; name: string; args: string; result?: string }>>([]);
  const [vimMode, setVimMode] = useState<VimMode>("insert");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    createRuntime({ cwd: props.cwd, configPath: props.config, interactive: true })
      .then((created) => {
        if (!mounted) return;
        const existing = created.sessions.list()[0];
        const active =
          existing ??
          created.sessions.create({
            provider: created.config.defaultProvider,
            model: created.config.defaultModel,
          });

        created.events.on("activity", (activity) => {
          setActivities((current) => [...current.slice(-10), activity]);
          const meta = activity.metadata;
          if (meta && meta.tool) {
            setToolCalls((current) => [
              ...current.slice(-8),
              {
                id: activity.id,
                name: String(meta.tool),
                args: meta.args ? JSON.stringify(meta.args) : "",
              },
            ]);
          }
        });
        created.events.on("approval:request", (request) => {
          setApprovals((current) => [...current, request]);
          setStatus("awaiting approval");
          setNotice(
            `Aprovação pendente: ${redactText(request.operation, collectSecretValues(created.config))}`,
          );
        });
        created.events.on("error", ({ error }) => {
          setNotice(redactText(error.message, collectSecretValues(created.config)));
        });

        setRuntime(created);
        setSession(active);
        setMessages(active.messages);
        setActivities(active.activities.slice(-10));
        setStatus(active.status);
      })
      .catch((err: unknown) =>
        setError(redactText(err instanceof Error ? err.message : String(err))),
      );
    return () => {
      mounted = false;
    };
  }, [props.cwd, props.config]);

  const theme = runtime ? getTheme(runtime.config.tui.theme) : getTheme("dark");

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "q") {
      abortRef.current?.abort();
      exit();
      return;
    }

    if (key.ctrl && inputChar === "c") {
      if (streaming) {
        abortRef.current?.abort();
        setStreaming(false);
        setStatus("cancelled");
        setNotice("Execução cancelada.");
      } else {
        exit();
      }
      return;
    }

    if (!runtime || !session) return;

    if (key.ctrl && inputChar === "h") {
      setViewMode("help");
      setVimMode("normal");
      setNotice("Ajuda aberta.");
      return;
    }

    if (key.ctrl && inputChar === "o") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice("Selecione uma sessão com ↑/↓ e Enter.");
      return;
    }

    if (key.ctrl && inputChar === "n") {
      createNewSession(runtime);
      return;
    }

    if (approvals.length > 0) {
      if (inputChar?.toLowerCase() === "a") {
        resolveApproval(runtime, approvals[0], true);
        return;
      }
      if (inputChar?.toLowerCase() === "d" || inputChar?.toLowerCase() === "n") {
        resolveApproval(runtime, approvals[0], false);
        return;
      }
      if (key.escape) {
        resolveApproval(runtime, approvals[0], false);
        return;
      }
    }

    if (viewMode === "sessions") {
      const sessionList = runtime.sessions.list();
      if (key.upArrow) {
        setSelectedSessionIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedSessionIndex((current) =>
          Math.min(Math.max(0, sessionList.length - 1), current + 1),
        );
        return;
      }
      if (key.return) {
        const selected = sessionList[selectedSessionIndex];
        if (selected) {
          switchSession(selected);
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
        return;
      }
      return;
    }

    if (viewMode === "config") {
      if (editingConfig) {
        const field = CONFIG_FIELDS[configEditIndex];
        if (key.escape) {
          setEditingConfig(false);
          setConfigEditValue("");
          return;
        }
        if (key.return) {
          if (field) {
            void saveConfigEdit(runtime, field, configEditValue);
          }
          return;
        }
        if (field?.type === "toggle") {
          if (inputChar?.toLowerCase() === "y" || inputChar?.toLowerCase() === "t" || inputChar?.toLowerCase() === "1") {
            setConfigEditValue("true");
          } else if (inputChar?.toLowerCase() === "n" || inputChar?.toLowerCase() === "f" || inputChar?.toLowerCase() === "0") {
            setConfigEditValue("false");
          }
          return;
        }
        if (key.backspace || key.delete) {
          setConfigEditValue((current) => current.slice(0, -1));
          return;
        }
        if (inputChar && !key.ctrl && !key.meta) {
          setConfigEditValue((current) => current + inputChar);
          return;
        }
        return;
      }

      if (key.upArrow || inputChar?.toLowerCase() === "k") {
        setConfigEditIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow || inputChar?.toLowerCase() === "j") {
        setConfigEditIndex((current) =>
          Math.min(CONFIG_FIELDS.length - 1, current + 1),
        );
        return;
      }
      if (key.return || inputChar?.toLowerCase() === "i" || inputChar?.toLowerCase() === "e") {
        const field = CONFIG_FIELDS[configEditIndex];
        if (field) {
          const currentValue = getConfigValue(runtime.config, field.key);
          setConfigEditValue(String(currentValue ?? ""));
          setEditingConfig(true);
          if (inputChar?.toLowerCase() === "i") setVimMode("insert");
        }
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
        return;
      }
      return;
    }

    if (viewMode === "help") {
      if (key.escape || key.return || inputChar?.toLowerCase() === "q") {
        setViewMode("chat");
        setVimMode("insert");
        setNotice("Chat ativo.");
      }
      return;
    }

    if (streaming) return;

    if (viewMode === "chat" && vimMode === "normal") {
      if (inputChar?.toLowerCase() === "i") {
        setVimMode("insert");
        return;
      }
      if (inputChar?.toLowerCase() === "a") {
        setVimMode("insert");
        return;
      }
      if (key.escape) {
        setVimMode("normal");
        return;
      }
      return;
    }

    if (key.return) {
      void submitInput(input.trim(), runtime, session);
      return;
    }

    if (key.upArrow) {
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      return;
    }

    if (key.downArrow) {
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? "");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((current) => current.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput((current) => current + inputChar);
    }
  });

  async function saveConfigEdit(
    activeRuntime: DeepCodeRuntime,
    field: ConfigFieldDef,
    value: string,
  ): Promise<void> {
    try {
      let parsed: string | number | boolean = value;
      if (field.type === "number") {
        parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          setConfigSaveStatus("Valor inválido");
          setEditingConfig(false);
          return;
        }
      } else if (field.type === "toggle") {
        parsed = ["true", "1", "yes", "on"].includes(value.toLowerCase());
      }

      const keys = field.key.split(".");
      const currentConfig = JSON.parse(JSON.stringify(activeRuntime.config)) as Record<string, unknown>;
      let obj: Record<string, unknown> = currentConfig;
      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (key && typeof obj[key] === "object" && obj[key] !== null) {
          obj = obj[key] as Record<string, unknown>;
        }
      }
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        obj[lastKey] = parsed;
      }

      const { ConfigLoader } = await import("@deepcode/core");
      const loader = new ConfigLoader();
      await loader.save({ cwd: props.cwd, configPath: props.config }, currentConfig as any);

      setConfigSaveStatus(`${field.label} atualizado`);
      setEditingConfig(false);
      setConfigEditValue("");
      setTimeout(() => setConfigSaveStatus(null), 3000);
    } catch (err) {
      setConfigSaveStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      setEditingConfig(false);
    }
  }

  async function submitInput(
    prompt: string,
    activeRuntime: DeepCodeRuntime,
    activeSession: Session,
  ): Promise<void> {
    if (!prompt) return;

    if (prompt.startsWith("/")) {
      handleCommand(prompt, activeRuntime);
      setInput("");
      return;
    }

    setInput("");
    setHistory((current) => [...current, prompt].slice(-50));
    setHistoryIndex(null);
    setStreaming(true);
    setAssistantDraft("");
    setStatus("executing");
    setNotice("Executando tarefa...");
    setToolCalls([]);

    const controller = new AbortController();
    abortRef.current = controller;
    const promise = activeRuntime.agent.run({
      session: activeSession,
      input: prompt,
      signal: controller.signal,
      onChunk: (text) => {
        setAssistantDraft(
          (current) => current + redactText(text, collectSecretValues(activeRuntime.config)),
        );
        setMessages([...activeSession.messages]);
      },
    });
    setMessages([...activeSession.messages]);

    try {
      await promise;
      setMessages([...activeSession.messages]);
      setActivities(activeSession.activities.slice(-10));
      setStatus(activeSession.status);
      setNotice("Tarefa concluída.");
    } catch (err) {
      setError(
        redactText(
          err instanceof Error ? err.message : String(err),
          collectSecretValues(activeRuntime.config),
        ),
      );
    } finally {
      setStreaming(false);
      setAssistantDraft("");
      abortRef.current = null;
    }
  }

  function handleCommand(command: string, activeRuntime: DeepCodeRuntime): void {
    const [name] = command.split(/\s+/, 1);
    if (name === "/help") {
      setViewMode("help");
      setVimMode("normal");
      setNotice("Ajuda aberta.");
      return;
    }
    if (name === "/clear") {
      setMessages([]);
      setAssistantDraft("");
      setNotice("Tela limpa. A sessão continua salva.");
      return;
    }
    if (name === "/new") {
      createNewSession(activeRuntime);
      return;
    }
    if (name === "/sessions") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
      setVimMode("normal");
      setNotice("Selecione uma sessão com ↑/↓ e Enter.");
      return;
    }
    if (name === "/config") {
      setConfigEditIndex(0);
      setEditingConfig(false);
      setConfigEditValue("");
      setConfigSaveStatus(null);
      setViewMode("config");
      setVimMode("normal");
      setNotice("Configuração: ↑/↓ ou j/k navega, Enter/i edita, Esc volta.");
      return;
    }
    setNotice(`Comando desconhecido: ${command}`);
  }

  function createNewSession(activeRuntime: DeepCodeRuntime): void {
    const next = activeRuntime.sessions.create({
      provider: activeRuntime.config.defaultProvider,
      model: activeRuntime.config.defaultModel,
    });
    setSession(next);
    setMessages([]);
    setActivities([]);
    setApprovals([]);
    setToolCalls([]);
    setStatus(next.status);
    setViewMode("chat");
    setVimMode("insert");
    setNotice(`Nova sessão: ${next.id}`);
  }

  function switchSession(next: Session): void {
    setSession(next);
    setMessages(next.messages);
    setActivities(next.activities.slice(-10));
    setApprovals([]);
    setToolCalls([]);
    setStatus(next.status);
    setAssistantDraft("");
    setViewMode("chat");
    setVimMode("insert");
    setNotice(`Sessão ativa: ${next.id}`);
  }

  function resolveApproval(
    activeRuntime: DeepCodeRuntime,
    request: ApprovalRequest | undefined,
    allowed: boolean,
  ): void {
    if (!request) return;
    activeRuntime.events.emit("approval:decision", {
      requestId: request.id,
      decision: {
        allowed,
        reason: allowed ? "Approved from TUI" : "Denied from TUI",
      },
    });
    setApprovals((current) => current.filter((item) => item.id !== request.id));
    setStatus(allowed ? "executing" : "denied");
    setNotice(
      `${allowed ? "Aprovado" : "Negado"}: ${redactText(request.operation, collectSecretValues(activeRuntime.config))}`,
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={theme.error} bold>
          DeepCode error
        </Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!runtime || !session) {
    return <Text>Carregando DeepCode...</Text>;
  }

  const visibleMessages = messages.slice(-12);
  const activeApproval = approvals[0];
  const sessionList = runtime.sessions.list();

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" borderStyle="single" paddingX={1} borderColor={theme.border}>
        <Text bold>DeepCode v1.0.0</Text>
        <Text>
          {runtime.config.defaultProvider}
          {runtime.config.defaultModel ? ` | ${runtime.config.defaultModel}` : ""}
          {vimMode === "normal" ? " | NORMAL" : ""}
          {` | ${runtime.config.tui.theme}`}
        </Text>
      </Box>

      <Box minHeight={20}>
        {activeApproval ? (
          <ApprovalPanel
            request={activeApproval}
            runtime={runtime}
            queueLength={approvals.length}
            theme={theme}
          />
        ) : viewMode === "sessions" ? (
          <SessionSwitcher
            sessions={sessionList}
            selectedIndex={selectedSessionIndex}
            activeId={session.id}
            theme={theme}
          />
        ) : viewMode === "config" ? (
          <ConfigEditor
            runtime={runtime}
            selectedIndex={configEditIndex}
            editing={editingConfig}
            editValue={configEditValue}
            saveStatus={configSaveStatus}
            theme={theme}
          />
        ) : viewMode === "help" ? (
          <HelpView theme={theme} />
        ) : (
          <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
            <Text bold>Chat</Text>
            {visibleMessages.length === 0 && (
              <Text color={theme.fgMuted}>Digite uma tarefa ou use /help.</Text>
            )}
            {visibleMessages.map((message) => (
              <MessageRow key={message.id} message={message} theme={theme} />
            ))}
            {assistantDraft && (
              <Text color={theme.assistantMsg}>
                assistant: {truncate(assistantDraft.replace(/\s+/g, " "), 900)}
              </Text>
            )}
          </Box>
        )}

        <Box width="35%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
          <Box>
            <Text bold>Status: </Text>
            <Text color={streaming ? theme.warning : status === "error" ? theme.error : theme.success} bold>
              {streaming ? "executing" : status}
            </Text>
          </Box>
          <Text color={theme.fgMuted}>Sessão: {session.id}</Text>
          <Text> </Text>
          <Text bold>Atividades</Text>
          {activities.length === 0 && <Text color={theme.fgMuted}>Sem atividade ainda.</Text>}
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} theme={theme} />
          ))}
          <Text> </Text>
          {toolCalls.length > 0 && (
            <>
              <Text bold>Tool calls</Text>
              {toolCalls.map((tc) => (
                <Text key={tc.id} color={theme.accent}>
                  → {tc.name} {tc.args ? truncate(tc.args, 50) : ""}
                </Text>
              ))}
              <Text> </Text>
            </>
          )}
          <Text>Aprovações: {approvals.length}</Text>
          {activeApproval && (
            <Box flexDirection="column" borderStyle="round" paddingX={1}>
              <Text color={theme.warning} bold>
                Pendente
              </Text>
              <Text>{approvalRiskLabel(activeApproval.level)}</Text>
              <Text color={theme.fgMuted}>A aprova | D nega | Esc nega</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box borderStyle="single" paddingX={1} borderColor={theme.border}>
        <Text>
          {viewMode === "chat"
            ? streaming
              ? "Executando..."
              : vimMode === "normal"
                ? "-- NORMAL -- pressione i para inserir"
                : `> ${input}_`
            : editingConfig
              ? `Editando: ${configEditValue}_`
              : "Enter/i edita | ↑/↓ ou j/k navega | Esc volta"}
        </Text>
      </Box>
      <Text color={theme.fgMuted}>{notice}</Text>
    </Box>
  );
}

function ActivityRow({ activity, theme }: { activity: Activity; theme: ThemeColors }) {
  const icon = activityTypeIcon(activity.type);
  return (
    <Text color={theme.fgMuted}>
      {icon} {truncate(activity.message, 60)}
    </Text>
  );
}

function activityTypeIcon(type: string): string {
  if (type.includes("read") || type.includes("file_read")) return "📖";
  if (type.includes("write") || type.includes("file_written")) return "✏️";
  if (type.includes("edit") || type.includes("file_edited")) return "📝";
  if (type.includes("bash") || type.includes("shell")) return "⚡";
  if (type.includes("git")) return "🔀";
  if (type.includes("search")) return "🔍";
  if (type.includes("test")) return "🧪";
  if (type.includes("lint")) return "✨";
  if (type.includes("web_fetch")) return "🌐";
  return "•";
}

function ApprovalPanel({
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
  return (
    <Box width="65%" flexDirection="column" borderStyle="double" paddingX={1} borderColor={theme.borderActive}>
      <Text color={theme.warning} bold>
        Aprovação necessária
      </Text>
      <Text>
        Nível: {request.level} | {approvalRiskLabel(request.level)}
      </Text>
      <Text>Operação</Text>
      <Text color={theme.primary}>{truncate(operation, 900)}</Text>
      {requestPath && (
        <>
          <Text>Caminho</Text>
          <Text color={theme.fgMuted}>{truncate(requestPath, 900)}</Text>
        </>
      )}
      {details.length > 0 && (
        <>
          <Text>Detalhes</Text>
          {details.map((line) => (
            <Text key={line} color={theme.fgMuted}>
              {truncate(line, 120)}
            </Text>
          ))}
        </>
      )}
      <Text>Solicitada: {formatSessionTime(request.createdAt)}</Text>
      <Text color={theme.warning}>A aprova | D nega | Esc nega</Text>
      {queueLength > 1 && (
        <Text color={theme.fgMuted}>{queueLength - 1} aprovação(ões) aguardando na fila.</Text>
      )}
    </Box>
  );
}

function MessageRow({ message, theme }: { message: Message; theme: ThemeColors }) {
  const content = truncate(message.content.replace(/\s+/g, " "), 900);
  return (
    <Text color={
      message.role === "user" ? theme.userMsg :
      message.role === "assistant" ? theme.assistantMsg :
      theme.toolMsg
    }>
      {message.role}: {content}
    </Text>
  );
}

function SessionSwitcher({
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
      <Text bold>Sessões</Text>
      {sessions.length === 0 && <Text color={theme.fgMuted}>Nenhuma sessão salva.</Text>}
      {sessions.slice(0, 12).map((item, index) => {
        const selected = index === selectedIndex;
        const active = item.id === activeId;
        return (
          <Text key={item.id} color={selected ? theme.primary : active ? theme.success : undefined}>
            {selected ? "> " : "  "}
            {item.id} {active ? "*" : " "} {item.status} {item.messages.length} msgs{" "}
            {formatSessionTime(item.updatedAt)}
          </Text>
        );
      })}
    </Box>
  );
}

function getConfigValue(config: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function ConfigEditor({
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
    secretPlaceholder: "[set]",
    emptySecretPlaceholder: "[empty]",
  }) as Record<string, unknown>;
  const providers = runtime.config.providers;

  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Text bold>Configuração (editável)</Text>
      <Text color={theme.fgMuted}>Provider: {String(config.defaultProvider)}</Text>
      <Text color={theme.fgMuted}>Model: {String(config.defaultModel ?? "não configurado")}</Text>
      <Text> </Text>
      <Text bold>Campos editáveis</Text>
      {CONFIG_FIELDS.map((field, index) => {
        const selected = index === selectedIndex;
        const currentValue = getConfigValue(runtime.config, field.key);
        const isApiKey = field.key.endsWith(".apiKey");
        const displayValue =
          field.type === "toggle"
            ? currentValue
              ? "enabled"
              : "disabled"
            : isApiKey
              ? currentValue
                ? "[set]"
                : "[empty]"
              : String(currentValue ?? "—");

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
        <Text color={saveStatus.startsWith("Erro") ? theme.error : theme.success}>{saveStatus}</Text>
      )}
      <Text color={theme.fgMuted}>
        {editing ? "Enter salva | Esc cancela" : "Enter/i edita | ↑/↓ ou j/k navega | Esc volta"}
      </Text>
      <Text> </Text>
      <Text bold>Providers</Text>
      {Object.entries(providers).map(([name, provider]) => (
        <Text key={name} color={provider.apiKey ? theme.success : theme.fgMuted}>
          {name}: {provider.apiKey ? "apiKey [set]" : "apiKey missing"}
          {provider.baseUrl ? ` | ${provider.baseUrl}` : ""}
        </Text>
      ))}
      <Text>GitHub: {runtime.config.github.token ? "token [set]" : "token missing"}</Text>
    </Box>
  );
}

function HelpView({ theme }: { theme: ThemeColors }) {
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1} borderColor={theme.border}>
      <Text bold>Ajuda</Text>
      <Text> </Text>
      <Text bold>Comandos</Text>
      <Text>/help abre ajuda</Text>
      <Text>/clear limpa a tela sem apagar sessão</Text>
      <Text>/new cria uma sessão real</Text>
      <Text>/sessions abre seletor de sessões</Text>
      <Text>/config abre editor de configuração</Text>
      <Text> </Text>
      <Text bold>Atalhos gerais</Text>
      <Text>Ctrl+O sessões | Ctrl+N nova sessão</Text>
      <Text>Ctrl+H ajuda | Ctrl+C cancela | Ctrl+Q sai</Text>
      <Text> </Text>
      <Text bold>Vim bindings (chat)</Text>
      <Text>i / a entra modo insert | Esc volta modo normal</Text>
      <Text> </Text>
      <Text bold>Vim bindings (config)</Text>
      <Text>j / k navega | i / e edita | Enter salva | Esc volta</Text>
      <Text> </Text>
      <Text bold>Aprovações</Text>
      <Text>A aprova | D nega | Esc volta/nega</Text>
      <Text> </Text>
      <Text bold>Temas disponíveis</Text>
      <Text>{themeNames.join(", ")}</Text>
      <Text>Altere via /config → Theme ou tui.theme no config</Text>
    </Box>
  );
}

function approvalRiskLabel(level: string): string {
  if (level === "dangerous") return "alto risco";
  if (level === "shell") return "execução de shell";
  if (level === "git_local") return "operação git local";
  if (level === "write") return "alteração de arquivo";
  if (level === "read") return "leitura";
  return "operação controlada";
}

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

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
