import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(appRoot, "dist", "index.js");
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("deepcode CLI e2e", () => {
  it("initializes config in a clean worktree", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    const result = await runCli(["--cwd", tempDir, "init"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(".deepcode/config.json");
    const config = JSON.parse(await readFile(path.join(tempDir, ".deepcode", "config.json"), "utf8")) as unknown;
    expect(config).toBeTruthy();
  });

  it("prints doctor failures without credentials", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    const result = await runCli(["--cwd", tempDir, "doctor"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("provider");
    expect(result.stdout).toContain("model");
  });

  it("exposes subagents and cache commands", async () => {
    const subagents = await runCli(["subagents", "--help"]);
    expect(subagents.exitCode).toBe(0);
    expect(subagents.stdout).toContain("run real child agent sessions");

    const cache = await runCli(["cache", "--help"]);
    expect(cache.exitCode).toBe(0);
    expect(cache.stdout).toContain("manage persistent tool cache");
  });
});

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [bin, ...args], { cwd: appRoot, timeout: 30_000 }, (error, stdout, stderr) => {
      const maybeExit = error as (NodeJS.ErrnoException & { code?: number | null }) | null;
      if (error && typeof maybeExit?.code !== "number") {
        reject(error);
        return;
      }
      resolve({ stdout, stderr, exitCode: typeof maybeExit?.code === "number" ? maybeExit.code : 0 });
    });
  });
}
