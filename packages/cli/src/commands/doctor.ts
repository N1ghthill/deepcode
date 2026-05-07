import { execFileAsync } from "@deepcode/core";
import { createRuntime } from "../runtime.js";

export async function doctorCommand(options: { cwd: string; config?: string }): Promise<void> {
  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: false });
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  checks.push(await commandCheck("git", ["--version"]));
  checks.push(await commandCheck("rg", ["--version"]));
  checks.push({
    name: "provider",
    ok: Boolean(runtime.config.providers[runtime.config.defaultProvider].apiKey),
    detail: `${runtime.config.defaultProvider} ${runtime.config.providers[runtime.config.defaultProvider].apiKey ? "configured" : "missing apiKey"}`,
  });
  checks.push({
    name: "model",
    ok: Boolean(runtime.config.defaultModel),
    detail: runtime.config.defaultModel ?? "missing defaultModel",
  });
  checks.push({
    name: "github",
    ok: Boolean(runtime.config.github.token),
    detail: runtime.config.github.token ? "token configured" : "token missing",
  });

  for (const server of runtime.config.lsp.servers) {
    checks.push(await commandCheck(`lsp:${server.command}`, ["--version"], server.command));
  }

  for (const check of checks) {
    console.log(`${check.ok ? "ok" : "fail"} ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function commandCheck(name: string, args: string[], command = name): Promise<{ name: string; ok: boolean; detail: string }> {
  try {
    const result = await execFileAsync(command, args, { cwd: process.cwd(), timeoutMs: 10_000 });
    if (result.exitCode === 0) {
      return {
        name,
        ok: true,
        detail: firstLine(result.stdout || result.stderr) || "available",
      };
    }
    return { name, ok: false, detail: firstLine(result.stderr || result.stdout) || `exit ${result.exitCode}` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function firstLine(input: string): string {
  return input.split(/\r?\n/).find(Boolean)?.trim() ?? "";
}
