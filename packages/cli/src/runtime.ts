import path from "node:path";
import {
  Agent,
  AuditLogger,
  ConfigLoader,
  EventBus,
  PathSecurity,
  PermissionGateway,
  ProviderManager,
  SessionManager,
  SubagentManager,
  createDefaultToolRegistry,
} from "@deepcode/core";
import type { DeepCodeConfig } from "@deepcode/shared";

export interface RuntimeOptions {
  cwd: string;
  configPath?: string;
  interactive: boolean;
}

export interface DeepCodeRuntime {
  config: DeepCodeConfig;
  events: EventBus;
  sessions: SessionManager;
  agent: Agent;
  subagents: SubagentManager;
}

export async function createRuntime(options: RuntimeOptions): Promise<DeepCodeRuntime> {
  const worktree = path.resolve(options.cwd);
  const config = await new ConfigLoader().load({ cwd: worktree, configPath: options.configPath });
  const events = new EventBus();
  const pathSecurity = new PathSecurity(worktree, config.paths);
  const audit = new AuditLogger(worktree);
  const permissions = new PermissionGateway(config, pathSecurity, audit, events, options.interactive);
  const sessions = new SessionManager(worktree);
  await sessions.loadAll();
  const providers = new ProviderManager(config);
  const tools = createDefaultToolRegistry();
  const agent = new Agent(providers, tools, sessions, config, permissions, pathSecurity, events);
  const subagents = new SubagentManager(agent, sessions, config.defaultProvider, config.defaultModel);
  return { config, events, sessions, agent, subagents };
}
