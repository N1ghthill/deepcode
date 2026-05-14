import { Effect } from "effect";
import { z } from "zod";
import { defineTool, type ToolDefinition } from "../tools/tool.js";
import type { McpClient, McpTool } from "./mcp-client.js";

export function adaptMcpTool(
  client: McpClient,
  tool: McpTool,
  serverName: string,
): ToolDefinition {
  const qualifiedName = `${serverName}__${tool.name}`;
  return defineTool({
    name: qualifiedName,
    description: tool.description ?? tool.name,
    parameters: z.record(z.unknown()).default({}),
    execute: (args) =>
      Effect.tryPromise({
        try: () => client.callTool(tool.name, args as Record<string, unknown>),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      }),
  });
}
