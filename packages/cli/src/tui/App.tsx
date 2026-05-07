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

export interface AppProps {
  cwd: string;
  config?: string;
}

const messageColors: Record<Message["role"], string> = {
  system: "gray",
  user: "cyan",
  assistant: "green",
  tool: "gray",
};

type ViewMode = "chat" | "sessions" | "config" | "help";

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
      setNotice("Ajuda aberta.");
      return;
    }

    if (key.ctrl && inputChar === "o") {
      setSelectedSessionIndex(0);
      setViewMode("sessions");
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
        setNotice("Chat ativo.");
        return;
      }
      return;
    }

    if (viewMode === "config" || viewMode === "help") {
      if (key.escape || key.return) {
        setViewMode("chat");
        setNotice("Chat ativo.");
      }
      return;
    }

    if (streaming) return;

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
      setNotice("Selecione uma sessão com ↑/↓ e Enter.");
      return;
    }
    if (name === "/config") {
      setViewMode("config");
      setNotice("Configuração aberta.");
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
    setStatus(next.status);
    setViewMode("chat");
    setNotice(`Nova sessão: ${next.id}`);
  }

  function switchSession(next: Session): void {
    setSession(next);
    setMessages(next.messages);
    setActivities(next.activities.slice(-10));
    setApprovals([]);
    setStatus(next.status);
    setAssistantDraft("");
    setViewMode("chat");
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
        <Text color="red" bold>
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
      <Box justifyContent="space-between" borderStyle="single" paddingX={1}>
        <Text bold>DeepCode v1.0.0</Text>
        <Text>
          Provider: {runtime.config.defaultProvider}
          {runtime.config.defaultModel ? ` | Model: ${runtime.config.defaultModel}` : ""}
        </Text>
      </Box>

      <Box minHeight={20}>
        {activeApproval ? (
          <ApprovalPanel
            request={activeApproval}
            runtime={runtime}
            queueLength={approvals.length}
          />
        ) : viewMode === "sessions" ? (
          <SessionSwitcher
            sessions={sessionList}
            selectedIndex={selectedSessionIndex}
            activeId={session.id}
          />
        ) : viewMode === "config" ? (
          <ConfigView runtime={runtime} />
        ) : viewMode === "help" ? (
          <HelpView />
        ) : (
          <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
            <Text bold>Chat</Text>
            {visibleMessages.length === 0 && (
              <Text color="gray">Digite uma tarefa ou use /help.</Text>
            )}
            {visibleMessages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
            {assistantDraft && (
              <Text color="green">
                assistant: {truncate(assistantDraft.replace(/\s+/g, " "), 900)}
              </Text>
            )}
          </Box>
        )}

        <Box width="35%" flexDirection="column" borderStyle="single" paddingX={1}>
          <Text bold>Status: {streaming ? "executing" : status}</Text>
          <Text color="gray">Sessão: {session.id}</Text>
          <Text>Atividades</Text>
          {activities.length === 0 && <Text color="gray">Sem atividade ainda.</Text>}
          {activities.map((activity) => (
            <Text key={activity.id}>- {truncate(activity.message, 70)}</Text>
          ))}
          <Text> </Text>
          <Text>Aprovações: {approvals.length}</Text>
          {activeApproval && (
            <Box flexDirection="column" borderStyle="round" paddingX={1}>
              <Text color="yellow" bold>
                Pendente
              </Text>
              <Text>{approvalRiskLabel(activeApproval.level)}</Text>
              <Text color="gray">A aprova | D nega | Esc nega</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box borderStyle="single" paddingX={1}>
        <Text>
          {viewMode === "chat"
            ? streaming
              ? "Executando..."
              : `> ${input}_`
            : "Enter seleciona | Esc volta"}
        </Text>
      </Box>
      <Text color="gray">{notice}</Text>
    </Box>
  );
}

function ApprovalPanel({
  request,
  runtime,
  queueLength,
}: {
  request: ApprovalRequest;
  runtime: DeepCodeRuntime;
  queueLength: number;
}) {
  const secretValues = collectSecretValues(runtime.config);
  const operation = redactText(request.operation, secretValues);
  const requestPath = request.path ? redactText(request.path, secretValues) : undefined;
  const details = formatApprovalDetails(request.details, secretValues);
  return (
    <Box width="65%" flexDirection="column" borderStyle="double" paddingX={1}>
      <Text color="yellow" bold>
        Aprovação necessária
      </Text>
      <Text>
        Nível: {request.level} | {approvalRiskLabel(request.level)}
      </Text>
      <Text>Operação</Text>
      <Text color="cyan">{truncate(operation, 900)}</Text>
      {requestPath && (
        <>
          <Text>Caminho</Text>
          <Text color="gray">{truncate(requestPath, 900)}</Text>
        </>
      )}
      {details.length > 0 && (
        <>
          <Text>Detalhes</Text>
          {details.map((line) => (
            <Text key={line} color="gray">
              {truncate(line, 120)}
            </Text>
          ))}
        </>
      )}
      <Text>Solicitada: {formatSessionTime(request.createdAt)}</Text>
      <Text color="yellow">A aprova | D nega | Esc nega</Text>
      {queueLength > 1 && (
        <Text color="gray">{queueLength - 1} aprovação(ões) aguardando na fila.</Text>
      )}
    </Box>
  );
}

function MessageRow({ message }: { message: Message }) {
  const content = truncate(message.content.replace(/\s+/g, " "), 900);
  return (
    <Text color={messageColors[message.role]}>
      {message.role}: {content}
    </Text>
  );
}

function SessionSwitcher({
  sessions,
  selectedIndex,
  activeId,
}: {
  sessions: Session[];
  selectedIndex: number;
  activeId: string;
}) {
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Sessões</Text>
      {sessions.length === 0 && <Text color="gray">Nenhuma sessão salva.</Text>}
      {sessions.slice(0, 12).map((item, index) => {
        const selected = index === selectedIndex;
        const active = item.id === activeId;
        return (
          <Text key={item.id} color={selected ? "cyan" : active ? "green" : undefined}>
            {selected ? "> " : "  "}
            {item.id} {active ? "*" : " "} {item.status} {item.messages.length} mensagens{" "}
            {formatSessionTime(item.updatedAt)}
          </Text>
        );
      })}
    </Box>
  );
}

function ConfigView({ runtime }: { runtime: DeepCodeRuntime }) {
  const config = redactSecrets(runtime.config, {
    secretPlaceholder: "[set]",
    emptySecretPlaceholder: "[empty]",
  }) as Record<string, unknown>;
  const providers = runtime.config.providers;
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Configuração</Text>
      <Text>Provider: {String(config.defaultProvider)}</Text>
      <Text>Model: {String(config.defaultModel ?? "não configurado")}</Text>
      <Text>
        Cache: {runtime.config.cache.enabled ? "enabled" : "disabled"} | TTL{" "}
        {runtime.config.cache.ttlSeconds}s
      </Text>
      <Text>Permissões</Text>
      <Text>
        read={runtime.config.permissions.read} write={runtime.config.permissions.write} shell=
        {runtime.config.permissions.shell} dangerous={runtime.config.permissions.dangerous}
      </Text>
      <Text>Providers</Text>
      {Object.entries(providers).map(([name, provider]) => (
        <Text key={name} color={provider.apiKey ? "green" : "gray"}>
          {name}: {provider.apiKey ? "apiKey [set]" : "apiKey missing"}
          {provider.baseUrl ? ` | ${provider.baseUrl}` : ""}
        </Text>
      ))}
      <Text>GitHub: {runtime.config.github.token ? "token [set]" : "token missing"}</Text>
    </Box>
  );
}

function HelpView() {
  return (
    <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Ajuda</Text>
      <Text>/help abre ajuda</Text>
      <Text>/clear limpa a tela sem apagar sessão</Text>
      <Text>/new cria uma sessão real</Text>
      <Text>/sessions abre seletor de sessões</Text>
      <Text>/config mostra configuração efetiva mascarada</Text>
      <Text>Ctrl+O abre sessões | Ctrl+N nova sessão | Ctrl+C cancela | Ctrl+Q sai</Text>
      <Text>A aprova | D nega | Esc volta/nega aprovação pendente</Text>
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
