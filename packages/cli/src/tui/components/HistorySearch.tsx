import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { ThemeColors } from "../themes.js";

interface HistorySearchProps {
  history: string[];
  theme: ThemeColors;
  isActive?: boolean;
  onSelect: (entry: string) => void;
  onClose: () => void;
}

export function HistorySearch({
  history,
  theme,
  isActive = false,
  onSelect,
  onClose,
}: HistorySearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reverse chronological, then filter
  const filtered = useMemo(() => {
    const reversed = [...history].reverse();
    if (!query.trim()) return reversed;
    const q = query.toLowerCase();
    return reversed.filter((entry) => entry.toLowerCase().includes(q));
  }, [history, query]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  useInput(
    (inputChar, key) => {
      if (key.escape) { onClose(); return; }
      if (key.upArrow) { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1)); return; }
      if (key.return) {
        const selected = filtered[safeIndex];
        if (selected) { onSelect(selected); onClose(); }
        return;
      }
    },
    { isActive },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text color={theme.primary} bold>Ctrl+R</Text>
        <Text color={theme.fgMuted}>Pesquisar histórico:</Text>
        <TextInput
          value={query}
          onChange={(v) => { setQuery(v); setSelectedIndex(0); }}
          onSubmit={() => {
            const selected = filtered[safeIndex];
            if (selected) { onSelect(selected); onClose(); }
          }}
          focus={isActive}
          placeholder="digite para filtrar..."
        />
      </Box>

      {filtered.length === 0 ? (
        <Text color={theme.fgMuted} dimColor>Nenhum resultado</Text>
      ) : (
        <Box flexDirection="column" paddingLeft={1}>
          {filtered.slice(0, 8).map((entry, idx) => (
            <Box key={idx} paddingX={1}>
              <Text
                color={idx === safeIndex ? theme.selectionFg : theme.fg}
                backgroundColor={idx === safeIndex ? theme.selectionBg : undefined}
              >
                {entry.length > 80 ? entry.slice(0, 77) + "..." : entry}
              </Text>
            </Box>
          ))}
          {filtered.length > 8 && (
            <Box paddingLeft={1}>
              <Text color={theme.fgMuted} dimColor>
                +{filtered.length - 8} more...
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={theme.fgMuted} dimColor>↑↓ navegar · Enter selecionar · Esc fechar</Text>
      </Box>
    </Box>
  );
}
