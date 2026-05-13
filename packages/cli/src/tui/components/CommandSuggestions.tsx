import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../themes.js";
import type { SlashCommandDef } from "../app-config.js";
import type { AutocompleteSuggestion } from "../hooks/useAutocomplete.js";

interface CommandSuggestionsProps {
  commands: SlashCommandDef[];
  fileSuggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  theme: ThemeColors;
}

export function CommandSuggestions({
  commands,
  fileSuggestions,
  selectedIndex,
  theme,
}: CommandSuggestionsProps) {
  const hasCommands = commands.length > 0;
  const hasFiles = fileSuggestions.length > 0;

  if (!hasCommands && !hasFiles) return null;

  const allItems: Array<{ key: string; label: string; desc: string; type: "command" | "file" | "test-file" }> = [
    ...commands.map((c) => ({ key: c.command, label: c.command, desc: c.description, type: "command" as const })),
    ...fileSuggestions.map((s) => ({
      key: s.value,
      label: s.value,
      desc: s.type === "test-file" ? "test file" : "file",
      type: s.type,
    })),
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      paddingX={1}
      marginBottom={1}
    >
      {allItems.slice(0, 10).map((item, idx) => {
        const isSelected = idx === selectedIndex;
        const typeColor = item.type === "command" ? theme.primary : item.type === "test-file" ? theme.warning : theme.accent;

        return (
          <Box
            key={item.key}
            flexDirection="row"
            gap={1}
            paddingX={1}
          >
            <Text color={typeColor} bold={isSelected}>
              {item.type === "command" ? "⚡" : item.type === "test-file" ? "🧪" : "📄"}
            </Text>
            <Text color={isSelected ? theme.selectionFg : theme.fg} bold={isSelected}>
              {item.label}
            </Text>
            <Text color={theme.fgMuted} dimColor>
              {item.desc}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
