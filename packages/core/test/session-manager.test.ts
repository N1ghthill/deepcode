import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "../src/sessions/session-manager.js";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("SessionManager", () => {
  it("skips and quarantines corrupted session files while loading valid sessions", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-sessions-"));
    const sessionsDir = path.join(tempDir, ".deepcode", "sessions");
    await mkdir(sessionsDir, { recursive: true });

    const manager = new SessionManager(tempDir);
    const session = manager.create({ provider: "openrouter", model: "model-x" });
    await manager.persist(session.id);
    await writeFile(path.join(sessionsDir, "broken.json"), "{\"id\":", "utf8");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const restored = new SessionManager(tempDir);
    const loaded = await restored.loadAll();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe(session.id);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken.json"));

    const quarantinedFiles = await readdir(path.join(sessionsDir, "corrupt"));
    expect(quarantinedFiles).toHaveLength(1);
    expect(quarantinedFiles[0]).toContain("broken.json");
  });
});
