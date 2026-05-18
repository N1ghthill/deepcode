import { buildSummaryMessage, buildSummaryPrompt } from "@deepcode/core";
import type { Session } from "@deepcode/shared";
import type { DeepCodeRuntime } from "../runtime.js";

/**
 * Calls the LLM to produce a compact summary of the session's conversation.
 * Returns the summary string, or null on error / not enough history.
 */
export async function generateCompactSummary(
  runtime: DeepCodeRuntime,
  session: Session,
  signal?: AbortSignal,
): Promise<string | null> {
  if (session.messages.length === 0) return null;

  try {
    const prompt = buildSummaryPrompt(session.messages);
    const summary = await runtime.agent.completeUtility({
      session,
      prompt,
      maxTokens: 400,
      temperature: 0.3,
      signal,
    });

    return summary.trim() || null;
  } catch {
    return null;
  }
}

export { buildSummaryMessage };
