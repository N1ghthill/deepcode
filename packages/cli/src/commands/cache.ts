import { createRuntime } from "../runtime.js";

import { writeStdoutLine } from "../stream-flush.js";

export async function cacheClearCommand(options: { cwd: string; config?: string }): Promise<void> {
  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: false });
  await runtime.cache.clear();
  await writeStdoutLine("DeepCode cache cleared.");
}
