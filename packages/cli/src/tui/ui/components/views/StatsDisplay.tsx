import type React from "react";
import { Box, Text } from "ink";
import { theme } from "../../semantic-colors.js";

interface StatsDisplayProps {
  duration: string;
  promptTokens?: number;
  outputTokens?: number;
  messageCount?: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, valueColor }) => (
  <Box>
    <Box width={26}>
      <Text color={theme.text.secondary}>{label}</Text>
    </Box>
    <Text color={valueColor ?? theme.text.primary}>{value}</Text>
  </Box>
);

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  duration,
  promptTokens,
  outputTokens,
  messageCount,
}) => (
  <Box
    borderStyle="round"
    borderColor={theme.border.default}
    flexDirection="column"
    paddingY={1}
    paddingX={2}
  >
    <Text bold color={theme.text.accent}>
      Estatísticas da Sessão
    </Text>
    <Box height={1} />
    <StatRow label="Tempo de sessão:" value={duration} />
    {messageCount !== undefined && (
      <StatRow label="Mensagens:" value={String(messageCount)} />
    )}
    {promptTokens !== undefined && promptTokens > 0 && (
      <StatRow
        label="Último prompt (tokens):"
        value={fmtTokens(promptTokens)}
        valueColor={theme.status.warning}
      />
    )}
    {outputTokens !== undefined && outputTokens > 0 && (
      <StatRow
        label="Última resposta (tokens):"
        value={fmtTokens(outputTokens)}
        valueColor={theme.status.warning}
      />
    )}
  </Box>
);
