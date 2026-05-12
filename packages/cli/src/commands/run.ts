import { collectSecretValues, redactText } from "@deepcode/core";
import { resolveUsableProviderTarget, type AgentMode } from "@deepcode/shared";
import { createRuntime } from "../runtime.js";

export async function runCommand(
  input: string,
  options: { cwd: string; config?: string; yes?: boolean; mode?: AgentMode },
): Promise<void> {
  if (options.mode && options.mode !== "plan" && options.mode !== "build") {
    throw new Error(`Invalid mode: ${options.mode}. Expected plan or build.`);
  }
  const runtime = await createRuntime({
    cwd: options.cwd,
    configPath: options.config,
    interactive: Boolean(options.yes),
  });
  if (options.yes) {
    runtime.events.on("approval:request", (request) => {
      runtime.events.emit("approval:decision", {
        requestId: request.id,
        decision: { allowed: true },
      });
    });
  }
  const target = resolveUsableProviderTarget(runtime.config, [runtime.config.defaultProvider]);
  const session = runtime.sessions.create({
    provider: target.provider,
    model: target.model,
  });
  const secretValues = collectSecretValues(runtime.config);
  const output = await runtime.agent.run({
    session,
    input,
    mode: options.mode ?? runtime.config.agentMode,
    onChunk: (text) => process.stdout.write(redactText(text, secretValues)),
  });
  if (!output) process.stdout.write("\n");
}
