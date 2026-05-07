import { Effect } from "effect";
import type { z } from "zod";
import type { Activity, DeepCodeConfig } from "@deepcode/shared";
import type { PermissionGateway } from "../security/permission-gateway.js";
import type { PathSecurity } from "../security/path-security.js";

export interface ToolContext {
  sessionId: string;
  messageId: string;
  worktree: string;
  directory: string;
  abortSignal: AbortSignal;
  config: DeepCodeConfig;
  permissions: PermissionGateway;
  pathSecurity: PathSecurity;
  logActivity(activity: Omit<Activity, "id" | "createdAt">): void;
}

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny, TResult = unknown> {
  name: string;
  description: string;
  parameters: TSchema;
  execute(args: z.infer<TSchema>, context: ToolContext): Effect.Effect<TResult, Error>;
}

export function defineTool<TSchema extends z.ZodTypeAny, TResult>(
  definition: ToolDefinition<TSchema, TResult>,
): ToolDefinition<TSchema, TResult> {
  return definition;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  descriptions(): string {
    return this.list()
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");
  }
}
