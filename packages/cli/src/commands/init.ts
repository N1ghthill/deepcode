import { ConfigLoader } from "@deepcode/core";

export async function initCommand(cwd: string): Promise<void> {
  const filePath = await new ConfigLoader().init(cwd);
  console.log(`DeepCode config created at ${filePath}`);
}
