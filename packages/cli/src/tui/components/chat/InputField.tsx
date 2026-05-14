import React, { useEffect, useState } from "react";
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
  cursorOffset: number;
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
  cursorOffset,
  streaming,
  focused,
  theme,
  placeholder,
}: InputFieldProps) {
  const isInputActive = focused && vimMode === "insert" && !streaming;
  const promptColor = isInputActive ? theme.primary : theme.fgMuted;

  return (
    <Box
      borderStyle="round"
      borderColor={isInputActive ? theme.borderActive : theme.border}
      paddingX={1}
    >
      {vimMode === "normal" ? (
        <Box flexDirection="row" gap={1}>
          <Text backgroundColor={theme.warning} color="black" bold>
            {" "}NORMAL{" "}
          </Text>
          {value.length === 0 ? (
            <Text color={theme.fgMuted}>{t("normalModeHint")}</Text>
          ) : (
            <Text>
              <Text color={theme.fg}>{value.slice(0, cursorOffset)}</Text>
              <Text backgroundColor={theme.fg} color={theme.bg}>
                {value[cursorOffset] ?? " "}
              </Text>
              <Text color={theme.fg}>{value.slice(cursorOffset + 1)}</Text>
            </Text>
          )}
        </Box>
      ) : streaming ? (
        <Box flexDirection="row" gap={1}>
          <AnimatedDots theme={theme} />
          <Text color={theme.fgMuted} dimColor>
            {t("streamingIndicator")}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row" gap={1}>
          <Text color={promptColor} bold>
            ▶
          </Text>
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

function AnimatedDots({ theme }: { theme: ThemeColors }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((prev) => (prev + 1) % 3), 350);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={theme.primary}>
      {step === 0 ? "●  ·" : step === 1 ? "·●  " : " ·● "}
    </Text>
  );
}
