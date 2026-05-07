import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Activity, Message } from "@deepcode/shared";
import { createRuntime, type DeepCodeRuntime } from "../runtime.js";

export interface AppProps {
  cwd: string;
  config?: string;
}

export function App(props: AppProps) {
  const { exit } = useApp();
  const [runtime, setRuntime] = useState<DeepCodeRuntime | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useMemo(
    () => runtime?.sessions.create({ provider: runtime.config.defaultProvider, model: runtime.config.defaultModel }),
    [runtime],
  );

  useEffect(() => {
    createRuntime({ cwd: props.cwd, configPath: props.config, interactive: true })
      .then((created) => {
        created.events.on("activity", (activity) => setActivities((current) => [...current.slice(-8), activity]));
        created.events.on("approval:request", (request) => {
          setActivities((current) => [
            ...current.slice(-8),
            {
              id: request.id,
              type: "approval",
              message: `Approval required: ${request.operation}`,
              createdAt: request.createdAt,
              metadata: request.details,
            },
          ]);
        });
        setRuntime(created);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [props.cwd, props.config]);

  useInput((inputChar, key) => {
    if (key.ctrl && (inputChar === "q" || inputChar === "c")) {
      exit();
      return;
    }
    if (!runtime || !session || streaming) return;
    if (key.return && input.trim()) {
      const prompt = input.trim();
      setInput("");
      setStreaming(true);
      runtime.agent
        .run({
          session,
          input: prompt,
          onChunk: () => setMessages([...session.messages]),
        })
        .then(() => setMessages([...session.messages]))
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setStreaming(false));
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

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">DeepCode error</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (!runtime || !session) {
    return <Text>Loading DeepCode...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" borderStyle="single" paddingX={1}>
        <Text bold>DeepCode v1.0.0</Text>
        <Text>Provider: {runtime.config.defaultProvider}</Text>
      </Box>
      <Box minHeight={18}>
        <Box width="65%" flexDirection="column" borderStyle="single" paddingX={1}>
          <Text bold>Chat</Text>
          {messages.slice(-12).map((message) => (
            <Text key={message.id} color={message.role === "user" ? "cyan" : message.role === "assistant" ? "green" : "gray"}>
              {message.role}: {message.content.slice(0, 500)}
            </Text>
          ))}
        </Box>
        <Box width="35%" flexDirection="column" borderStyle="single" paddingX={1}>
          <Text bold>Status: {streaming ? "executing" : session.status}</Text>
          <Text>Activities</Text>
          {activities.map((activity) => (
            <Text key={activity.id}>- {activity.message}</Text>
          ))}
        </Box>
      </Box>
      <Box borderStyle="single" paddingX={1}>
        <Text>{streaming ? "Waiting for model..." : `> ${input}_`}</Text>
      </Box>
      <Text color="gray">Ctrl+Q exits. Enter sends.</Text>
    </Box>
  );
}
