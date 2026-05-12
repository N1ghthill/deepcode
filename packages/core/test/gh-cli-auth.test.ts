import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileAsyncMock, spawnMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("../src/tools/process.js", () => ({
  execFileAsync: execFileAsyncMock,
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { loginWithGitHubCli } from "../src/github/gh-cli-auth.js";

afterEach(() => {
  execFileAsyncMock.mockReset();
  spawnMock.mockReset();
});

describe("loginWithGitHubCli", () => {
  it("opens browser login when gh auth status is invalid even if a token can still be read", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "invalid token" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "gho_test_token\n", stderr: "" });
    spawnMock.mockImplementation(() => createChildProcess({ stdout: "browser flow\n" }));

    const output: string[] = [];
    const token = await loginWithGitHubCli({
      cwd: process.cwd(),
      onOutput: (chunk) => output.push(chunk),
    });

    expect(token).toBe("gho_test_token");
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([
      "auth",
      "login",
      "--hostname",
      "github.com",
      "--web",
      "--git-protocol",
      "https",
      "--skip-ssh-key",
    ]);
    expect(output.join("")).toContain("opening browser login");
  });

  it("imports the existing token without opening the browser when gh auth status is valid", async () => {
    execFileAsyncMock
      .mockResolvedValueOnce({ exitCode: 0, stdout: "Logged in", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "gho_existing_token\n", stderr: "" });

    const output: string[] = [];
    const token = await loginWithGitHubCli({
      cwd: process.cwd(),
      onOutput: (chunk) => output.push(chunk),
    });

    expect(token).toBe("gho_existing_token");
    expect(spawnMock).not.toHaveBeenCalled();
    expect(output.join("")).toContain("already authenticated");
  });
});

function createChildProcess({
  exitCode = 0,
  stdout = "",
  stderr = "",
}: {
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
}) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  globalThis.setTimeout(() => {
    if (stdout) child.stdout.write(stdout);
    if (stderr) child.stderr.write(stderr);
    child.stdout.end();
    child.stderr.end();
    child.emit("close", exitCode);
  }, 0);

  return child;
}
