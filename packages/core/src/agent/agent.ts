import { Effect } from "effect";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createId, nowIso, type Activity, type DeepCodeConfig, type ProviderId, type Session, type ToolCall } from "@deepcode/shared";
import type { EventBus } from "../events/event-bus.js";
import { ProviderManager } from "../providers/provider-manager.js";
import type { PermissionGateway } from "../security/permission-gateway.js";
import type { PathSecurity } from "../security/path-security.js";
import type { SessionManager } from "../sessions/session-manager.js";
import type { ToolContext, ToolRegistry } from "../tools/tool.js";
import { TaskPlanner } from "./task-planner.js";

export interface AgentRunOptions {
  session: Session;
  input: string;
  provider?: ProviderId;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}

export class Agent {
  private readonly planner = new TaskPlanner();

  constructor(
    private readonly providerManager: ProviderManager,
    private readonly tools: ToolRegistry,
    private readonly sessions: SessionManager,
    private readonly config: DeepCodeConfig,
    private readonly permissions: PermissionGateway,
    private readonly pathSecurity: PathSecurity,
    private readonly eventBus: EventBus,
  ) {}

  async run(options: AgentRunOptions): Promise<string> {
    const session = options.session;
    this.sessions.addMessage(session.id, { role: "user", content: options.input });
    session.status = "planning";
    const planningProvider = this.providerManager.get(options.provider ?? session.provider);
    try {
      session.metadata.plan = await this.planner.plan(options.input, (prompt) =>
        planningProvider.complete(prompt, {
          model: session.model ?? this.config.defaultModel,
          maxTokens: Math.min(this.config.maxTokens, 2048),
          temperature: 0,
          signal: options.signal,
        }),
      );
    } catch (error) {
      session.metadata.planError = error instanceof Error ? error.message : String(error);
    }

    let finalText = "";
    let iterations = 0;
    const maxIterations = this.config.maxIterations;
    session.status = "executing";

    while (iterations < maxIterations) {
      iterations += 1;
      const chunks = this.providerManager.chat(session.messages, {
        preferredProvider: options.provider ?? session.provider,
        failover: this.failoverOrder(options.provider ?? session.provider),
        model: session.model ?? this.config.defaultModel,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        tools: this.toolDefinitions(),
        signal: options.signal,
      });

      let assistantText = "";
      let toolCalls = 0;
      for await (const chunk of chunks) {
        if (chunk.type === "delta") {
          assistantText += chunk.content;
          finalText += chunk.content;
          options.onChunk?.(chunk.content);
        }
        if (chunk.type === "tool_call") {
          toolCalls += 1;
          const result = await this.executeTool(chunk.call, session, options.signal);
          this.sessions.addMessage(session.id, {
            role: "tool",
            content: result,
            toolCallId: chunk.call.id,
          });
        }
      }

      if (assistantText.trim()) {
        this.sessions.addMessage(session.id, { role: "assistant", content: assistantText });
      }
      if (toolCalls === 0) break;
    }

    session.status = "idle";
    this.sessions.save(session);
    await this.sessions.persist(session.id);
    return finalText.trim();
  }

  private async executeTool(call: ToolCall, session: Session, signal?: AbortSignal): Promise<string> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return `Error: tool not found: ${call.name}`;
    }
    const parsed = tool.parameters.safeParse(call.arguments);
    if (!parsed.success) {
      return `Error: invalid arguments for ${call.name}: ${parsed.error.message}`;
    }

    const context: ToolContext = {
      sessionId: session.id,
      messageId: createId("msg"),
      worktree: session.worktree,
      directory: session.worktree,
      abortSignal: signal ?? new AbortController().signal,
      permissions: this.permissions,
      pathSecurity: this.pathSecurity,
      logActivity: (activity) => {
        const full: Activity = { ...activity, id: createId("activity"), createdAt: nowIso() };
        session.activities.push(full);
        this.eventBus.emit("activity", full);
      },
    };

    try {
      const result = await Effect.runPromise(tool.execute(parsed.data, context));
      return typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.eventBus.emit("error", { error: error instanceof Error ? error : new Error(message), context: { tool: call.name } });
      return `Error running ${call.name}: ${message}`;
    }
  }

  private toolDefinitions(): Array<Record<string, unknown>> {
    return this.tools.list().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters, { target: "openApi3" }),
      },
    }));
  }

  private failoverOrder(primary: ProviderId): ProviderId[] {
    return (["openrouter", "anthropic", "openai", "deepseek", "opencode"] as ProviderId[]).filter(
      (provider) => provider !== primary,
    );
  }
}
