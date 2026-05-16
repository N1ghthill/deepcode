/**
 * Config-init message hook — DeepCode stub.
 *
 * Qwen Code surfaces MCP connection progress in the footer during startup.
 * DeepCode connects MCP servers in the runtime; the stub reports no transient
 * message, so the footer shows its normal content immediately.
 */

export function useConfigInitMessage(_isConfigInitialized: boolean): string | null {
  return null;
}
