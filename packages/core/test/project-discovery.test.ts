import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileAsyncMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn(),
}));

vi.mock("../src/tools/process.js", () => ({
  execFileAsync: execFileAsyncMock,
}));

import { ProjectDiscovery } from "../src/agent/project-discovery.js";
import type { PathSecurity } from "../src/security/path-security.js";
import type { PermissionGateway } from "../src/security/permission-gateway.js";

let tempDir: string | undefined;

afterEach(async () => {
  execFileAsyncMock.mockReset();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

const pathSecurity = {
  normalize: async (p: string) => p,
} as unknown as PathSecurity;

const permissions = {
  ensure: async () => {},
} as unknown as PermissionGateway;

describe("ProjectDiscovery", () => {
  it("finds git repos and returns a numbered list", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-discovery-"));
    const repoA = path.join(tempDir, "project-a");
    const repoB = path.join(tempDir, "project-b");
    await mkdir(path.join(repoA, ".git"), { recursive: true });
    await mkdir(path.join(repoB, ".git"), { recursive: true });

    execFileAsyncMock.mockResolvedValue({ exitCode: 0, stdout: "git version 2.x", stderr: "" });

    const discovery = new ProjectDiscovery();
    const result = await discovery.discover(tempDir, tempDir, pathSecurity, permissions);

    expect(result.paths).toHaveLength(2);
    expect(result.formatted).toContain("1.");
    expect(result.formatted).toContain("2.");
    expect(result.formatted).toContain("Digite o número para selecionar:");
  });

  it("returns empty result when no git repos are found", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-discovery-"));
    await mkdir(path.join(tempDir, "just-a-dir"), { recursive: true });

    execFileAsyncMock.mockResolvedValue({ exitCode: 0, stdout: "git version 2.x", stderr: "" });

    const discovery = new ProjectDiscovery();
    const result = await discovery.discover(tempDir, tempDir, pathSecurity, permissions);

    expect(result.formatted).toBe("");
    expect(result.paths).toHaveLength(0);
  });

  it("skips node_modules and hidden directories", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-discovery-"));
    // These should NOT be found
    await mkdir(path.join(tempDir, "node_modules", "some-pkg", ".git"), { recursive: true });
    await mkdir(path.join(tempDir, ".hidden", ".git"), { recursive: true });
    // This one SHOULD be found
    const visible = path.join(tempDir, "my-repo");
    await mkdir(path.join(visible, ".git"), { recursive: true });

    execFileAsyncMock.mockResolvedValue({ exitCode: 0, stdout: "git version 2.x", stderr: "" });

    const discovery = new ProjectDiscovery();
    const result = await discovery.discover(tempDir, tempDir, pathSecurity, permissions);

    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toBe(visible);
  });
});
