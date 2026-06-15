import { describe, expect, it } from "vitest";
import { createTaskTool } from "../src/tools/task-tool.js";
import type { SessionManager } from "../src/sessions/session-manager.js";
import type { SubagentManager } from "../src/agent/subagent-manager.js";

describe("createTaskTool", () => {
  it("marks task activity as subagent activity for UI consumers", () => {
    const tool = createTaskTool(
      {} as SubagentManager,
      "/tmp/worktree",
      {} as SessionManager,
    );

    expect(tool.name).toBe("task");
    expect(tool.activityKind).toBe("subagent");
  });
});
