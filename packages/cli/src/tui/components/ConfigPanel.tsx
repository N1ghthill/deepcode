import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { ThemeColors } from "../themes.js";
import type { DeepCodeRuntime } from "../../runtime.js";
import { CONFIG_FIELDS } from "../app-config.js";
import { getConfigValue, serializeConfigDisplayValue } from "../app-utils.js";

interface ConfigPanelProps {
  runtime: DeepCodeRuntime;
  theme: ThemeColors;
  isActive?: boolean;
  onClose?: () => void;
  onSave?: (field: string, value: string) => Promise<void>;
}

export function ConfigPanel({
  runtime,
  theme,
  isActive = false,
  onClose,
  onSave,
}: ConfigPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");

  useInput(
    (inputChar, key) => {
      if (key.escape) {
        if (editing) {
          setEditing(false);
          return;
        }
        onClose?.();
        return;
      }

      if (editing) return;

      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(CONFIG_FIELDS.length - 1, i + 1));
        return;
      }
      if (key.return) {
        const field = CONFIG_FIELDS[selectedIndex];
        if (field) {
          const current = serializeConfigDisplayValue(getConfigValue(runtime.config, field.key));
          setEditValue(current);
          setEditing(true);
          setSaveStatus("idle");
        }
        return;
      }
    },
    { isActive },
  );

  const field = CONFIG_FIELDS[selectedIndex];

  async function handleSave(value: string) {
    if (!field || !onSave) return;
    setEditing(false);
    setSaveStatus("saving");
    try {
      await onSave(field.key, value);
      setSaveStatus("ok");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      <Box marginBottom={1} flexDirection="row" gap={2}>
        <Text bold color={theme.primary}>Configuração</Text>
        {saveStatus === "saving" && <Text color={theme.warning}>Salvando...</Text>}
        {saveStatus === "ok" && <Text color={theme.success}>✓ Salvo</Text>}
        {saveStatus === "error" && <Text color={theme.error}>✗ Erro ao salvar</Text>}
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {CONFIG_FIELDS.map((f, idx) => {
          const isSelected = idx === selectedIndex;
          const value = serializeConfigDisplayValue(getConfigValue(runtime.config, f.key));
          const isEditing = isSelected && editing;

          return (
            <Box
              key={f.key}
              flexDirection="row"
              gap={1}
              paddingX={1}
            >
              <Text color={isSelected ? theme.selectionFg : theme.fgMuted} dimColor={!isSelected}>
                {isSelected ? "▶" : " "}
              </Text>
              <Text color={isSelected ? theme.selectionFg : theme.fg} bold={isSelected}>
                {f.label}
              </Text>
              <Text color={theme.fgMuted}>:</Text>
              {isEditing ? (
                <TextInput
                  value={editValue}
                  onChange={setEditValue}
                  onSubmit={(v) => void handleSave(v)}
                  focus
                />
              ) : (
                <Text color={isSelected ? theme.accent : theme.fgMuted}>
                  {value || "(not set)"}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text color={theme.fgMuted} dimColor>↑↓ navegar · Enter editar · Esc fechar</Text>
      </Box>
    </Box>
  );
}
