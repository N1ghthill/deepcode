import { createId, type ToolCall } from "@deepcode/shared";
import { parseToolArgumentsObject } from "../providers/tool-arguments.js";
import type { ToolSchemaMode } from "../providers/model-execution-profile.js";

const MAX_TOOL_OUTPUT_LENGTH = 16_000;

export function compactToolDescription(description: string, schemaMode: ToolSchemaMode): string {
  const maxLength = schemaMode === "full" ? 240 : schemaMode === "compact" ? 140 : 96;
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength - 3).trimEnd()}...`;
}

export function simplifyToolSchema(schema: unknown, schemaMode: ToolSchemaMode): Record<string, unknown> {
  const normalized = sanitizeSchemaNode(schema, schemaMode, 0);
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }

  return { type: "object", properties: {} };
}

export function buildFallbackToolCallPrompt(allowedToolNames: Set<string>): string {
  return [
    "Tool fallback for this model:",
    "Prefer native tool calling when the model supports it.",
    "If you need a tool and native tool calling is unavailable for this model, emit exactly one XML block in this format:",
    "<tool_call>{\"name\":\"tool_name\",\"arguments\":{\"key\":\"value\"}}</tool_call>",
    "Do not wrap the JSON in markdown fences.",
    "Use only a tool name from this turn's allowed set.",
    `Allowed tool names: ${[...allowedToolNames].join(", ")}`,
    "If no tool is needed, answer normally with plain text.",
  ].join("\n");
}

export function applyFallbackToolCallParsing(
  assistantText: string,
  nativeToolCalls: ToolCall[],
  allowedToolNames: Set<string>,
): { assistantText: string; toolCalls: ToolCall[] } {
  if (nativeToolCalls.length > 0) {
    return {
      assistantText: stripFallbackToolEnvelope(assistantText),
      toolCalls: nativeToolCalls,
    };
  }

  const fallbackCall = extractFallbackToolCall(assistantText, allowedToolNames);
  if (!fallbackCall) {
    return {
      assistantText: stripFallbackToolEnvelope(assistantText),
      toolCalls: nativeToolCalls,
    };
  }

  return {
    assistantText: fallbackCall.cleanedText,
    toolCalls: [fallbackCall.call],
  };
}

export function truncateToolOutput(output: string, maxLength: number = MAX_TOOL_OUTPUT_LENGTH): string {
  if (output.length <= maxLength) return output;

  const halfLength = Math.floor((maxLength - 50) / 2);
  const start = output.slice(0, halfLength);
  const end = output.slice(-halfLength);
  const omitted = output.length - halfLength * 2;

  return `${start}\n\n... [${omitted} characters omitted - output truncated to prevent context overflow] ...\n\n${end}`;
}

function sanitizeSchemaNode(
  value: unknown,
  schemaMode: ToolSchemaMode,
  depth: number,
): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeSchemaNode(item, schemaMode, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const input = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    if (shouldDropSchemaKey(key, schemaMode, depth)) {
      continue;
    }

    const normalizedChild = sanitizeSchemaNode(child, schemaMode, depth + 1);
    if (normalizedChild !== undefined) {
      next[key] = normalizedChild;
    }
  }

  if (next.type === "object") {
    const properties = next.properties;
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      const propertyNames = new Set(Object.keys(properties as Record<string, unknown>));
      if (Array.isArray(next.required)) {
        next.required = next.required.filter(
          (item): item is string => typeof item === "string" && propertyNames.has(item),
        );
      }
    }
  }

  return next;
}

function shouldDropSchemaKey(
  key: string,
  schemaMode: ToolSchemaMode,
  depth: number,
): boolean {
  if (key === "$schema" || key === "definitions" || key === "$defs") {
    return true;
  }

  if (
    schemaMode !== "full"
    && (key === "title" || key === "default" || key === "examples" || key === "example" || key === "deprecated")
  ) {
    return true;
  }

  if (schemaMode === "minimal" && key === "description" && depth > 0) {
    return true;
  }

  return false;
}

function extractFallbackToolCall(
  assistantText: string,
  allowedToolNames: Set<string>,
): { call: ToolCall; cleanedText: string } | undefined {
  const match = assistantText.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i);
  if (!match || match.index === undefined) {
    return undefined;
  }

  const payload = parseFallbackToolPayload(match[1] ?? "");
  if (!payload || !allowedToolNames.has(payload.name)) {
    return undefined;
  }

  const cleanedText = collapseFallbackWhitespace(
    `${assistantText.slice(0, match.index)}${assistantText.slice(match.index + match[0].length)}`,
  );
  return {
    call: {
      id: createId("toolcall"),
      name: payload.name,
      arguments: payload.arguments,
    },
    cleanedText,
  };
}

function stripFallbackToolEnvelope(assistantText: string): string {
  return collapseFallbackWhitespace(
    assistantText.replace(/<tool_call>\s*[\s\S]*?\s*<\/tool_call>/gi, ""),
  );
}

function parseFallbackToolPayload(
  raw: string,
): { name: string; arguments: Record<string, unknown> } | undefined {
  const payload = parseFallbackJsonObject(raw);
  if (!payload) {
    return undefined;
  }

  const name = firstStringField(payload, ["name", "tool", "tool_name"]);
  if (!name) {
    return undefined;
  }

  const explicitArguments = firstObjectField(payload, ["arguments", "args", "input"]);
  if (explicitArguments) {
    return { name, arguments: explicitArguments };
  }

  const argumentsObject = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !["name", "tool", "tool_name"].includes(key)),
  );
  return { name, arguments: argumentsObject };
}

function parseFallbackJsonObject(raw: string): Record<string, unknown> | undefined {
  const payload = parseToolArgumentsObject(raw);
  if (Object.keys(payload).length > 0) {
    return payload;
  }
  return undefined;
}

function firstStringField(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    if (typeof payload[key] === "string" && payload[key]) {
      return payload[key] as string;
    }
  }
  return undefined;
}

function firstObjectField(
  payload: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function collapseFallbackWhitespace(input: string): string {
  return input
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
