import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../themes.js";
import type { Activity } from "@deepcode/shared";

interface SessionTimelineProps {
  activities: Activity[];
  theme: ThemeColors;
  isActive?: boolean;
  onClose?: () => void;
}

const TOOL_ICON: Record<string, string> = {
  read_file: "📄",
  write_file: "✏️",
  edit_file: "✏️",
  run_lint: "🔍",
  run_tests: "🧪",
  shell: "🐚",
  git: "🔀",
  search: "🔎",
  web: "🌐",
};

function getToolIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICON)) {
    if (lower.includes(key)) return icon;
  }
  return "⚡";
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function SessionTimeline({
  activities,
  theme,
  isActive = false,
  onClose,
}: SessionTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput(
    (inputChar, key) => {
      if (key.escape || inputChar?.toLowerCase() === "q") {
        onClose?.();
        return;
      }
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(activities.length - 1, i + 1));
        return;
      }
    },
    { isActive },
  );

  if (activities.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color={theme.fgMuted}>No activities in this session yet.</Text>
      </Box>
    );
  }

  const selected = activities[selectedIndex];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold color={theme.primary}>Session Timeline</Text>
        <Text color={theme.fgMuted}> ({activities.length} events)</Text>
      </Box>

      <Box flexDirection="row" flexGrow={1} gap={1}>
        {/* List */}
        <Box flexDirection="column" flexGrow={1}>
          {activities.map((activity, idx) => {
            const toolName = String(activity.metadata?.tool ?? "action");
            const icon = getToolIcon(toolName);
            const isSelected = idx === selectedIndex;
            const pathStr = activity.metadata?.path ? String(activity.metadata.path as string).slice(-40) : "";

            return (
              <Box key={activity.id} flexDirection="row" gap={1} paddingX={1}>
                <Text color={theme.fgMuted} dimColor>
                  {String(idx + 1).padStart(3, " ")}.
                </Text>
                <Text>{icon}</Text>
                <Text
                  color={isSelected ? theme.selectionFg : theme.fg}
                  backgroundColor={isSelected ? theme.selectionBg : undefined}
                >
                  {toolName.replace(/_/g, " ")}
                </Text>
                {pathStr && (
                  <Text color={theme.fgMuted} dimColor>{pathStr}</Text>
                )}
                <Text color={theme.fgMuted} dimColor>
                  {formatTimestamp(activity.createdAt)}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Detail panel */}
        {selected && (
          <Box
            flexDirection="column"
            width={28}
            borderStyle="single"
            borderColor={theme.border}
            paddingX={1}
          >
            <Text bold color={theme.primary}>Detail</Text>
            <Text color={theme.fg}>{String(selected.metadata?.tool ?? "")}</Text>
            {Boolean(selected.metadata?.path) && (
              <Text color={theme.fgMuted}>{String(selected.metadata?.path as string ?? "")}</Text>
            )}
            {Boolean(selected.metadata?.result) && (
              <Text color={theme.success}>
                {String(selected.metadata?.result as string ?? "").slice(0, 120)}
              </Text>
            )}
          </Box>
        )}
      </Box>

      <Box paddingX={1}>
        <Text color={theme.fgMuted} dimColor>↑↓ navigate · Esc close</Text>
      </Box>
    </Box>
  );
}
