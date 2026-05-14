import { ConfigLoader } from "@deepcode/core";
import { writeStdoutLine } from "../stream-flush.js";

export async function initCommand(cwd: string): Promise<void> {
  const filePath = await new ConfigLoader().init(cwd);
  await writeStdoutLine(`DeepCode config created at ${filePath}`);
}
