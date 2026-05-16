import { Box, Text } from "ink";

export interface AppProps {
  cwd: string;
  config?: string;
}

/**
 * Migration stub. The Qwen-derived TUI is being ported in incrementally;
 * this placeholder keeps `cli/index.ts` resolvable while the shell is built.
 */
export function App(_props: AppProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>DeepCode</Text>
      <Text dimColor>TUI migration in progress.</Text>
    </Box>
  );
}
