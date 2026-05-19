import { Effect } from "effect";
import { z } from "zod";
import { createId } from "@deepcode/shared";
import type { ProviderId } from "@deepcode/shared";
import { defineTool, type ToolDefinition } from "./tool.js";
import type { SubagentManager } from "../agent/subagent-manager.js";
import { loadAgentConfigs } from "../agent/agent-config-loader.js";

const TaskSchema = z.object({
  prompt: z.string().describe("Full task description for the subagent — be specific and self-contained."),
  subagent_type: z.string().optional().describe(
    "Named agent type from .deepcode/agents/*.md (e.g. 'code-reviewer'). " +
    "When set, the subagent uses the named agent's system prompt and tool restrictions.",
  ),
  provider: z.string().optional().describe("Provider override (e.g. 'anthropic', 'openai'). Defaults to current provider."),
  model: z.string().optional().describe("Model override. Defaults to current model."),
  fork: z.boolean().optional().describe("If true, the subagent starts with the current conversation history as context."),
});

export function createTaskTool(subagents: SubagentManager, worktree: string): ToolDefinition {
  return defineTool({
    name: "task",
    description:
      "Launch a subagent to handle a self-contained task in a child session. " +
      "Use for parallelizable work, delegating a well-scoped subtask, or specialized analysis. " +
      "Built-in subagent_type values: code-reviewer (read-only code analysis), test-runner (run tests and interpret output), refactor (surgical code changes without behavior change). " +
      "Set fork=true to give the subagent the current conversation history as starting context. " +
      "Custom agents can be defined in .deepcode/agents/<name>.md.",
    parameters: TaskSchema,
    execute: (args, context) =>
      Effect.tryPromise(async () => {
        const taskId = createId("task");

        // Resolve named agent config if subagent_type is given
        let systemPrompt: string | undefined;
        let allowedTools: string[] | undefined;
        let disallowedTools: string[] | undefined;
        let resolvedModel = args.model;

        if (args.subagent_type) {
          const configs = loadAgentConfigs(worktree);
          const agentConfig = configs.find((c) => c.name === args.subagent_type);
          if (!agentConfig) {
            throw new Error(
              `Unknown subagent_type '${args.subagent_type}'. ` +
              `Available: ${configs.map((c) => c.name).join(", ") || "(none — create .deepcode/agents/<name>.md)"}`,
            );
          }
          systemPrompt = agentConfig.systemPrompt || undefined;
          allowedTools = agentConfig.allowedTools;
          disallowedTools = agentConfig.disallowedTools;
          if (!resolvedModel && agentConfig.model) resolvedModel = agentConfig.model;
        }

        const task = {
          id: taskId,
          prompt: args.prompt,
          provider: args.provider as ProviderId | undefined,
          model: resolvedModel,
          systemPrompt,
          allowedTools,
          disallowedTools,
        };

        const result = args.fork
          ? await subagents.forkFrom(context.sessionId, task, context.abortSignal)
          : await subagents.runOne(task, context.abortSignal);

        if (result.error) {
          throw new Error(`Subagent failed: ${result.error}`);
        }
        return result.output || "(subagent completed with no output)";
      }),
  });
}
