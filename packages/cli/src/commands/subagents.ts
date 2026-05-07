import { createRuntime } from "../runtime.js";

export async function subagentsRunCommand(options: {
  cwd: string;
  config?: string;
  tasks: string[];
  concurrency?: number;
  yes?: boolean;
}): Promise<void> {
  if (options.tasks.length === 0) {
    throw new Error("Provide at least one --task.");
  }

  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: Boolean(options.yes) });
  if (options.yes) {
    runtime.events.on("approval:request", (request) => {
      runtime.events.emit("approval:decision", {
        requestId: request.id,
        decision: { allowed: true, reason: "Approved by subagents --yes" },
      });
    });
  }

  const results = await runtime.subagents.runParallel(
    options.tasks.map((prompt, index) => ({
      id: `task-${index + 1}`,
      prompt,
    })),
    { concurrency: options.concurrency },
  );

  for (const result of results) {
    console.log(`## ${result.taskId} (${result.sessionId})`);
    if (result.error) {
      console.log(`error: ${result.error}`);
      continue;
    }
    console.log(result.output || "(no output)");
  }
}
