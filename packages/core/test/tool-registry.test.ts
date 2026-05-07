import { describe, expect, it } from "vitest";
import { createDefaultToolRegistry } from "../src/tools/registry.js";

describe("createDefaultToolRegistry", () => {
  it("registers production tool implementations", () => {
    const registry = createDefaultToolRegistry();
    expect(registry.get("read_file")).toBeDefined();
    expect(registry.get("write_file")).toBeDefined();
    expect(registry.get("search_text")).toBeDefined();
    expect(registry.get("git")).toBeDefined();
  });
});
