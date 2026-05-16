/**
 * Status-line hook — DeepCode stub.
 *
 * Qwen Code supports a user-configurable custom status line in the footer.
 * DeepCode does not ship that setting yet; the stub reports no status lines so
 * the footer falls back to the standard hint/mode row.
 */

export interface UseStatusLineReturn {
  lines: string[];
}

export function useStatusLine(): UseStatusLineReturn {
  return { lines: [] };
}
