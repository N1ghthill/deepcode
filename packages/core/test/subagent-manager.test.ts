import { describe, expect, it } from "vitest";
import type { Agent } from "../src/agent/agent.js";
import { SubagentManager } from "../src/agent/subagent-manager.js";
import { SessionManager } from "../src/sessions/session-manager.js";

describe("SubagentManager", () => {
  it("runs tasks in child sessions", async () => {
    const sessions = new SessionManager("/tmp/deepcode-subagent-test");
    const fakeAgent = {
      run: async ({ input }: { input: string }) => `done:${input}`,
    } as unknown as Agent;
    const manager = new SubagentManager(fakeAgent, sessions, "openrouter", "model");
    const results = await manager.runParallel(
      [
        { id: "a", prompt: "A" },
        { id: "b", prompt: "B" },
      ],
      { concurrency: 2 },
    );
    expect(results.map((result) => result.output).sort()).toEqual(["done:A", "done:B"]);
    expect(sessions.list().every((session) => session.metadata.subagent === true)).toBe(true);
  });
});
