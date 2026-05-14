import { createId, isModelContextMessage, nowIso, type Message } from "@deepcode/shared";

/** Rough token estimate: ~4 chars per token. Good enough for triggering compression. */
export function estimateTokens(messages: Message[]): number {
  return Math.ceil(
    messages.reduce((sum, m) => {
      let chars = m.content.length;
      if (m.toolCalls) {
        chars += m.toolCalls.reduce(
          (s, tc) => s + tc.name.length + JSON.stringify(tc.arguments).length,
          0,
        );
      }
      return sum + chars;
    }, 0) / 4,
  );
}

export function shouldCompressContext(
  messages: Message[],
  maxContextTokens: number,
  threshold: number,
): boolean {
  return estimateTokens(messages) > maxContextTokens * threshold;
}

/**
 * Splits session messages into two buckets:
 * - `toSummarize`: older model-context messages to be replaced by a summary
 * - `toKeep`: the most recent `keepRecentCount` model-context messages
 *
 * Returns null if there aren't enough messages to summarize.
 */
export function splitForCompression(
  messages: Message[],
  keepRecentCount: number,
): { toSummarize: Message[]; toKeep: Message[]; rest: Message[] } | null {
  const contextMessages = messages.filter(isModelContextMessage);
  if (contextMessages.length <= keepRecentCount) return null;

  const cutoff = contextMessages.length - keepRecentCount;
  const toSummarize = contextMessages.slice(0, cutoff);
  const toKeep = contextMessages.slice(cutoff);
  const rest = messages.filter((m) => !isModelContextMessage(m));

  return { toSummarize, toKeep, rest };
}

export function buildSummaryPrompt(messages: Message[]): string {
  const lines = messages.map((m) => {
    const role = m.role === "tool" ? "tool result" : m.role;
    return `[${role}] ${m.content.slice(0, 1500)}`;
  });
  return [
    "Summarize the following conversation history concisely. Capture:",
    "- Files read, created, or edited (with key content changes)",
    "- Commands executed and their outcomes",
    "- Key decisions and findings",
    "- Current state of any ongoing task",
    "",
    "History:",
    lines.join("\n\n"),
  ].join("\n");
}

export function buildSummaryMessage(summary: string): Message {
  return {
    id: createId("msg"),
    role: "user",
    source: "context_summary",
    content: `[Context summary of earlier conversation]\n${summary}`,
    createdAt: nowIso(),
  };
}
