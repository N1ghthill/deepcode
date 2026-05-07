import { createRuntime } from "../runtime.js";

export async function runCommand(input: string, options: { cwd: string; config?: string; yes?: boolean }): Promise<void> {
  const runtime = await createRuntime({
    cwd: options.cwd,
    configPath: options.config,
    interactive: Boolean(options.yes),
  });
  if (options.yes) {
    runtime.events.on("approval:request", (request) => {
      runtime.events.emit("approval:decision", { requestId: request.id, decision: { allowed: true } });
    });
  }
  const session = runtime.sessions.create({
    provider: runtime.config.defaultProvider,
    model: runtime.config.defaultModel,
  });
  const output = await runtime.agent.run({
    session,
    input,
    onChunk: (text) => process.stdout.write(text),
  });
  if (!output) process.stdout.write("\n");
}
