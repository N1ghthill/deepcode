import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { ThemeColors } from "../../themes.js";
import type { VimMode } from "../../types.js";
import { t } from "../../i18n/index.js";

interface InputFieldProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  vimMode: VimMode;
  streaming: boolean;
  focused: boolean;
  theme: ThemeColors;
  placeholder?: string;
}

export function InputField({
  value,
  onChange,
  onSubmit,
  vimMode,
  streaming,
  focused,
  theme,
  placeholder,
}: InputFieldProps) {
  const isInputActive = focused && vimMode === "insert" && !streaming;

  return (
    <Box borderStyle="single" borderColor={isInputActive ? theme.borderActive : theme.border} paddingX={1}>
      {vimMode === "normal" ? (
        <Box flexDirection="row" gap={1}>
          <Text color={theme.warning} bold>
            {t("normalModeIndicator")}
          </Text>
          <Text color={theme.fgMuted}>{value || t("normalModeHint")}</Text>
        </Box>
      ) : streaming ? (
        <Box flexDirection="row" gap={1}>
          <Text color={theme.fgMuted}>{t("streamingIndicator")}</Text>
        </Box>
      ) : (
        <Box flexDirection="row" gap={1}>
          <Text color={theme.primary} bold>›</Text>
          <TextInput
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            focus={isInputActive}
            placeholder={placeholder ?? t("inputPlaceholder")}
            showCursor={isInputActive}
          />
        </Box>
      )}
    </Box>
  );
}
