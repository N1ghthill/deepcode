import React from "react";
import { Box, Text } from "ink";
import type { ThemeColors } from "../../themes.js";

export interface CommandPreviewProps {
  theme: ThemeColors;
  command: string;
  args: string[];
  workingDir?: string;
  estimatedRisk?: 'low' | 'medium' | 'high';
}

export function CommandPreview({
  theme,
  command,
  args,
  workingDir,
  estimatedRisk,
}: CommandPreviewProps) {
  const fullCommand = `${command} ${args.join(' ')}`;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>
        Preview do Comando
      </Text>
      <Text> </Text>

      {workingDir && (
        <Text color={theme.fgMuted}>
          Diretório: {workingDir}
        </Text>
      )}

      <Box paddingY={1}>
        <Text color={theme.warning} bold>
          $ {fullCommand}
        </Text>
      </Box>

      {estimatedRisk && (
        <Text color={
          estimatedRisk === 'high' ? theme.error :
          estimatedRisk === 'medium' ? theme.warning :
          theme.success
        }>
          Risco estimado: {estimatedRisk === 'high' ? 'ALTO' : estimatedRisk === 'medium' ? 'MÉDIO' : 'BAIXO'}
        </Text>
      )}

      <Text color={theme.fgMuted}>
        Args: {args.map((a, i) => `[${i}] "${a}"`).join(', ')}
      </Text>
    </Box>
  );
}
