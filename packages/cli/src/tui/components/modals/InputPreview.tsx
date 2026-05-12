import React from "react";
import { Box, Text, useInput } from "ink";
import type { ThemeColors } from "../../themes.js";

export interface InputPreviewProps {
  theme: ThemeColors;
  input: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
  estimatedTokens?: number;
}

export function InputPreview({
  theme,
  input,
  onConfirm,
  onCancel,
  onEdit,
  estimatedTokens,
}: InputPreviewProps) {
  useInput((inputChar, key) => {
    if (key.return) {
      onConfirm();
    } else if (key.escape) {
      onCancel();
    } else if (inputChar?.toLowerCase() === 'e') {
      onEdit();
    }
  });

  const lines = input.split('\n');
  const displayLines = lines.slice(0, 20);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.borderActive}
      paddingX={1}
    >
      <Text bold color={theme.primary}>
        Preview da Mensagem
      </Text>
      <Text color={theme.fgMuted}>
        Enter envia | Esc cancela | e edita
      </Text>
      <Text> </Text>

      {estimatedTokens !== undefined && (
        <Text color={theme.accent}>
          Tokens estimados: ~{estimatedTokens}
        </Text>
      )}

      <Text color={theme.fgMuted}>---</Text>

      <Box flexDirection="column">
        {displayLines.map((line, index) => (
          <Text key={index} color={theme.userMsg}>
            {line || " "}
          </Text>
        ))}
        {lines.length > 20 && (
          <Text color={theme.fgMuted} dimColor>
            ... e mais {lines.length - 20} linhas
          </Text>
        )}
      </Box>

      <Text color={theme.fgMuted}>---</Text>
      <Text> </Text>

      <Box flexDirection="column">
        <Text color={theme.success}>Enter - Enviar mensagem</Text>
        <Text color={theme.warning}>e - Voltar para edição</Text>
        <Text color={theme.error}>Esc - Cancelar</Text>
      </Box>
    </Box>
  );
}
