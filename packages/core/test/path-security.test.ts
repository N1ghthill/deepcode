import path from "node:path";
import { describe, expect, it } from "vitest";
import { PathSecurity } from "../src/security/path-security.js";

describe("PathSecurity", () => {
  it("allows files inside the worktree", () => {
    const worktree = path.resolve("/tmp/deepcode-test");
    const security = new PathSecurity(worktree, {
      whitelist: ["${WORKTREE}/**"],
      blacklist: ["**/.env"],
    });
    expect(security.isAllowed(path.join(worktree, "src/index.ts"))).toBe(true);
  });

  it("blocks blacklisted paths", () => {
    const worktree = path.resolve("/tmp/deepcode-test");
    const security = new PathSecurity(worktree, {
      whitelist: ["${WORKTREE}/**"],
      blacklist: ["**/.env"],
    });
    expect(security.isAllowed(path.join(worktree, ".env"))).toBe(false);
  });
});
