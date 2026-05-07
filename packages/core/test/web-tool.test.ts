import { describe, it, expect } from "vitest";
import { fetchWebTool } from "../src/tools/web-tool.js";

describe("fetch_web tool", () => {
  it("has correct name and description", () => {
    expect(fetchWebTool.name).toBe("fetch_web");
    expect(fetchWebTool.description).toContain("Fetch content from a URL");
  });

  it("validates URL parameter", () => {
    const result = fetchWebTool.parameters.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts valid URL", () => {
    const result = fetchWebTool.parameters.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts optional maxLength", () => {
    const result = fetchWebTool.parameters.safeParse({
      url: "https://example.com",
      maxLength: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects maxLength above 50000", () => {
    const result = fetchWebTool.parameters.safeParse({
      url: "https://example.com",
      maxLength: 100000,
    });
    expect(result.success).toBe(false);
  });
});
