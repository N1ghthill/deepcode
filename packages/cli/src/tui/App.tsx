import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Activity, Message, Session } from "@deepcode/shared";
import type { ApprovalRequest } from "@deepcode/core";
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
  const [notice, setNotice] = useState("Ctrl+Q sai. Enter envia. /help mostra comandos.");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    createRuntime({ cwd: props.cwd, configPath: props.config, interactive: true })
      .then((created) => {
        if (!mounted) return;
        const existing = created.sessions.list()[0];
        const active =
          existing ?? created.sessions.create({ provider: created.config.defaultProvider, model: created.config.defaultModel });

        created.events.on("activity", (activity) => {
          setActivities((current) => [...current.slice(-10), activity]);
        });
        created.events.on("approval:request", (request) => {
          setApprovals((current) => [...current, request]);
          setStatus("awaiting approval");
          setNotice(`Aprovação pendente: ${request.operation}`);
        });
        created.events.on("error", ({ error }) => {
          setNotice(error.message);
        });

        setRuntime(created);
        setSession(active);
        setMessages(active.messages);
        setActivities(active.activities.slice(-10));
        setStatus(active.status);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
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

  async function submitInput(prompt: string, activeRuntime: DeepCodeRuntime, activeSession: Session): Promise<void> {
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
        setAssistantDraft((current) => current + text);
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setAssistantDraft("");
      abortRef.current = null;
    }
  }

  function handleCommand(command: string, activeRuntime: DeepCodeRuntime): void {
    const [name] = command.split(/\s+/, 1);
    if (name === "/help") {
      setNotice("/help, /clear, /new, /sessions. Atalhos: Ctrl+Q sai, Ctrl+C cancela, A aprova, D nega.");
      return;
    }
    if (name === "/clear") {
      setMessages([]);
      setAssistantDraft("");
      setNotice("Tela limpa. A sessão continua salva.");
      return;
    }
    if (name === "/new") {
      const next = activeRuntime.sessions.create({
        provider: activeRuntime.config.defaultProvider,
        model: activeRuntime.config.defaultModel,
      });
      setSession(next);
      setMessages([]);
      setActivities([]);
      setApprovals([]);
      setStatus(next.status);
      setNotice(`Nova sessão: ${next.id}`);
      return;
    }
    if (name === "/sessions") {
      const summary = activeRuntime.sessions
        .list()
        .slice(0, 5)
        .map((item) => `${item.id} ${item.status} ${item.messages.length} mensagens`)
        .join(" | ");
      setNotice(summary || "Nenhuma sessão salva.");
      return;
    }
    setNotice(`Comando desconhecido: ${command}`);
  }

  function resolveApproval(activeRuntime: DeepCodeRuntime, request: ApprovalRequest | undefined, allowed: boolean): void {
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
    setNotice(`${allowed ? "Aprovado" : "Negado"}: ${request.operation}`);
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
        <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
          <Text bold>Chat</Text>
          {visibleMessages.length === 0 && <Text color="gray">Digite uma tarefa ou use /help.</Text>}
          {visibleMessages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
          {assistantDraft && (
            <Text color="green">
              assistant: {truncate(assistantDraft.replace(/\s+/g, " "), 900)}
            </Text>
          )}
        </Box>

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
                {activeApproval.level}
              </Text>
              <Text>{truncate(activeApproval.operation, 70)}</Text>
              {activeApproval.path && <Text color="gray">{truncate(activeApproval.path, 70)}</Text>}
              <Text color="gray">A aprova | D nega | Esc nega</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box borderStyle="single" paddingX={1}>
        <Text>{streaming ? "Executando..." : `> ${input}_`}</Text>
      </Box>
      <Text color="gray">{notice}</Text>
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

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(0, maxLength - 3))}...`;
}
