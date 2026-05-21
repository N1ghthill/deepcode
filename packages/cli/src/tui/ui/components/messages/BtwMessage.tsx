import React from "react";
import { Box, Text } from "ink";
import type { BtwProps } from "../../types.js";
import { theme } from "../../semantic-colors.js";
import { MarkdownDisplay } from "../../utils/MarkdownDisplay.js";
import { useTerminalSize } from "../../hooks/useTerminalSize.js";

export interface BtwDisplayProps {
  btw: BtwProps;
  containerWidth?: number;
}

// border(1)*2 + paddingX(1)*2 = 4
const BTW_SELF_CHROME = 4;

function normalizeCodeFences(text: string): string {
  return text.replace(/([^\n])(```|~~~)/g, "$1\n$2");
}

const BtwMessageInternal: React.FC<BtwDisplayProps> = ({ btw, containerWidth }) => {
  const { columns: terminalWidth } = useTerminalSize();
  const baseWidth = containerWidth ?? terminalWidth;
  const contentWidth = Math.max(2, baseWidth - BTW_SELF_CHROME);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.status.warning}
      paddingX={1}
      width="100%"
    >
      <Box flexDirection="row">
        <Text color={theme.status.warning} bold>
          {"/btw "}
        </Text>
        <Text wrap="wrap" color={theme.status.warning}>
          {btw.question}
        </Text>
      </Box>
      {btw.isPending ? (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.status.warning}>{"+ "}</Text>
            <Text color={theme.status.warning}>Respondendo...</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Pressione Esc, Ctrl+C ou Ctrl+D para cancelar</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <MarkdownDisplay
            text={normalizeCodeFences(btw.answer)}
            isPending={false}
            contentWidth={contentWidth}
          />
          <Box marginTop={1}>
            <Text dimColor>Pressione Espaço, Enter ou Esc para fechar</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const BtwMessage = React.memo(BtwMessageInternal);
