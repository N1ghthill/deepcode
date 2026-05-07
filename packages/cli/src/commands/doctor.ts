import { execFileAsync, GitHubClient, redactText } from "@deepcode/core";
import type { Model } from "@deepcode/shared";
import { createRuntime, type DeepCodeRuntime } from "../runtime.js";

export async function doctorCommand(options: { cwd: string; config?: string }): Promise<void> {
  const runtime = await createRuntime({
    cwd: options.cwd,
    configPath: options.config,
    interactive: false,
  });
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  checks.push(await commandCheck("git", ["--version"]));
  checks.push(await commandCheck("rg", ["--version"]));
  checks.push(...(await providerChecks(runtime)));
  checks.push(await githubCheck(runtime.config.github, options.cwd));

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

async function providerChecks(
  runtime: DeepCodeRuntime,
): Promise<Array<{ name: string; ok: boolean; detail: string }>> {
  const configuredProvider = runtime.config.defaultProvider;
  const configuredModel = runtime.config.defaultModel;
  const apiKey = runtime.config.providers[configuredProvider].apiKey;
  if (!apiKey) {
    return [
      { name: "provider", ok: false, detail: `${configuredProvider} missing apiKey` },
      {
        name: "model",
        ok: Boolean(configuredModel),
        detail: configuredModel ?? "missing defaultModel",
      },
    ];
  }

  let models: Model[];
  try {
    models = await withTimeout(
      (signal) => runtime.providers.get(configuredProvider).listModels({ signal }),
      10_000,
    );
  } catch (error) {
    return [
      {
        name: "provider",
        ok: false,
        detail: redactText(error instanceof Error ? error.message : String(error)),
      },
      {
        name: "model",
        ok: Boolean(configuredModel),
        detail: configuredModel ?? "missing defaultModel",
      },
    ];
  }

  const providerDetail = `${configuredProvider} authenticated; ${models.length} models visible`;
  if (!configuredModel) {
    return [
      { name: "provider", ok: true, detail: providerDetail },
      { name: "model", ok: false, detail: "missing defaultModel" },
    ];
  }

  const modelFound = models.some((model) => model.id === configuredModel);
  return [
    { name: "provider", ok: true, detail: providerDetail },
    {
      name: "model",
      ok: modelFound,
      detail: modelFound
        ? configuredModel
        : `${configuredModel} not returned by ${configuredProvider} /models`,
    },
  ];
}

async function commandCheck(
  name: string,
  args: string[],
  command = name,
): Promise<{ name: string; ok: boolean; detail: string }> {
  try {
    const result = await execFileAsync(command, args, { cwd: process.cwd(), timeoutMs: 10_000 });
    if (result.exitCode === 0) {
      return {
        name,
        ok: true,
        detail: firstLine(result.stdout || result.stderr) || "available",
      };
    }
    return {
      name,
      ok: false,
      detail: firstLine(result.stderr || result.stdout) || `exit ${result.exitCode}`,
    };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function githubCheck(
  config: {
    token?: string;
    enterpriseUrl?: string;
  },
  cwd: string,
): Promise<{ name: string; ok: boolean; detail: string }> {
  if (!config.token) {
    return { name: "github", ok: false, detail: "token missing" };
  }
  try {
    const user = await new GitHubClient({
      token: config.token,
      enterpriseUrl: config.enterpriseUrl,
      worktree: cwd,
    }).getAuthenticatedUser();
    return { name: "github", ok: true, detail: `authenticated as ${user.login}` };
  } catch (error) {
    return {
      name: "github",
      ok: false,
      detail: redactText(error instanceof Error ? error.message : String(error)),
    };
  }
}

function firstLine(input: string): string {
  return input.split(/\r?\n/).find(Boolean)?.trim() ?? "";
}

function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return operation(controller.signal).finally(() => clearTimeout(timeout));
}
