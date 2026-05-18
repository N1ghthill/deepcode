import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import path from "node:path";
import { SessionManager } from "@deepcode/core";
import type { Session } from "@deepcode/shared";

interface SessionsAppProps {
  cwd: string;
}

export function SessionsApp({ cwd }: SessionsAppProps) {
  const { exit } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [terminalHeight, setTerminalHeight] = useState(process.stdout.rows ?? 24);

  useEffect(() => {
    const onResize = () => setTerminalHeight(process.stdout.rows ?? 24);
    process.stdout.on("resize", onResize);
    return () => { process.stdout.off("resize", onResize); };
  }, []);

  useEffect(() => {
    const manager = new SessionManager(cwd);
    manager.loadAll()
      .then((loaded) => {
        const sorted = [...loaded].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setSessions(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cwd]);

  const handleExit = useCallback(
    (sessionId?: string) => {
      if (sessionId) {
        process.stdout.write(`${sessionId}\n`);
      }
      exit();
    },
    [exit],
  );

  const clampedActive = Math.min(activeIndex, Math.max(0, sessions.length - 1));
  const listAreaHeight = Math.max(4, terminalHeight - 10);
  const scrollOffset = Math.max(
    0,
    Math.min(clampedActive - Math.floor(listAreaHeight / 2), sessions.length - listAreaHeight),
  );
  const visibleSessions = sessions.slice(scrollOffset, scrollOffset + listAreaHeight);

  useInput(
    (input, key) => {
      if (key.upArrow || input === "k") {
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setActiveIndex((i) => Math.min(sessions.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const session = sessions[clampedActive];
        if (session) handleExit(session.id);
        return;
      }
      if (input === "q" || key.escape || (key.ctrl && input === "c")) {
        handleExit();
      }
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text color="cyan">Loading sessions from {path.join(cwd, ".deepcode", "sessions")}...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between" marginBottom={0}>
          <Text bold color="cyan">Sessions</Text>
          <Text color="gray">[{sessions.length}]  ↑/↓ navigate</Text>
        </Box>
        <Box flexDirection="column" height={listAreaHeight}>
          {sessions.length === 0 && (
            <Text color="gray">
              No sessions found in {path.join(cwd, ".deepcode", "sessions")}
            </Text>
          )}
          {visibleSessions.map((session, visIdx) => {
            const globalIdx = scrollOffset + visIdx;
            const isActive = globalIdx === clampedActive;
            const shortId = session.id.slice(-8);
            const date = new Date(session.updatedAt).toLocaleString();
            const target = session.model
              ? `${session.provider}/${session.model}`
              : session.provider;
            const msgCount = session.messages.length;
            const sessionName = typeof session.metadata["name"] === "string"
              ? session.metadata["name"]
              : undefined;
            const firstUser = session.messages.find((m) => m.role === "user");
            const preview = sessionName ?? firstUser?.content?.slice(0, 60) ?? "(no messages)";

            return (
              <Box key={session.id} flexDirection="column">
                <Box>
                  <Text color={isActive ? "cyan" : undefined}>
                    {isActive ? "▶ " : "  "}
                  </Text>
                  <Text bold={isActive} color={isActive ? "cyan" : undefined} wrap="truncate-end">
                    {preview}
                  </Text>
                </Box>
                {isActive && (
                  <Box paddingLeft={4}>
                    <Text color="gray">
                      {shortId}  {target}  {msgCount} msgs  {date}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">[Enter] resume  [↑/↓ j/k] navigate  [q/Esc] quit</Text>
      </Box>
    </Box>
  );
}
