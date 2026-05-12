import type { ProviderId } from "@deepcode/shared";

export type ToolSchemaMode = "full" | "compact" | "minimal";
export type ToolCallStrategy = "native" | "native-with-xml-fallback";

export interface ModelExecutionProfile {
  toolSchemaMode: ToolSchemaMode;
  supportsRequiredToolChoice: boolean;
  toolCallStrategy: ToolCallStrategy;
}

export function resolveModelExecutionProfile(
  provider: ProviderId,
  model?: string,
): ModelExecutionProfile {
  const normalized = model?.toLowerCase() ?? "";
  const openAIFamily = matchesAny(normalized, ["gpt-", "/gpt-", "o1", "o3", "o4", "o5"]);
  const claudeFamily = normalized.includes("claude");
  const geminiFamily = normalized.includes("gemini");
  const qwenFamily = normalized.includes("qwen");
  const kimiFamily = matchesAny(normalized, ["kimi", "moonshot"]);
  const miniMaxFamily = normalized.includes("minimax");
  const deepSeekFamily = normalized.includes("deepseek");
  const reasonerFamily = matchesAny(normalized, ["reasoner", "thinking"]);

  if (provider === "anthropic") {
      return {
        toolSchemaMode: "full",
        supportsRequiredToolChoice: true,
        toolCallStrategy: "native",
      };
  }

  if (provider === "openai") {
      return {
        toolSchemaMode: openAIFamily ? "full" : "compact",
        supportsRequiredToolChoice: true,
        toolCallStrategy: openAIFamily ? "native" : "native-with-xml-fallback",
      };
  }

  if (provider === "deepseek") {
      return {
        toolSchemaMode: reasonerFamily ? "minimal" : "compact",
        supportsRequiredToolChoice: false,
        toolCallStrategy: "native-with-xml-fallback",
      };
  }

  if (openAIFamily || claudeFamily || geminiFamily) {
      return {
        toolSchemaMode: "full",
        supportsRequiredToolChoice: true,
        toolCallStrategy: "native",
      };
  }

  if (reasonerFamily) {
      return {
        toolSchemaMode: "minimal",
        supportsRequiredToolChoice: false,
        toolCallStrategy: "native-with-xml-fallback",
      };
  }

  if (qwenFamily || kimiFamily || miniMaxFamily || deepSeekFamily) {
      return {
        toolSchemaMode: "compact",
        supportsRequiredToolChoice: false,
        toolCallStrategy: "native-with-xml-fallback",
      };
  }

  return {
    toolSchemaMode: provider === "openrouter" || provider === "opencode" ? "compact" : "full",
    supportsRequiredToolChoice: false,
    toolCallStrategy: "native",
  };
}

function matchesAny(input: string, patterns: string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}
