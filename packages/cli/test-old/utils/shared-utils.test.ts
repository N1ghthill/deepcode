import { describe, expect, it } from "vitest";
import { truncate } from "../../src/tui/utils/truncate.js";
import { traverseErrorChain, formatErrorChain } from "@deepcode/core";

describe("truncate utility", () => {
  it("returns the original string when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis when over limit", () => {
    expect(truncate("hello world this is long", 10)).toBe("hello w...");
  });

  it("handles exact length strings", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles empty strings", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("handles very small max lengths", () => {
    expect(truncate("hello", 3)).toBe("...");
  });
});

describe("traverseErrorChain utility", () => {
  it("extracts a single error message", () => {
    const err = new Error("single error");
    expect(traverseErrorChain(err)).toEqual(["single error"]);
  });

  it("traverses nested cause chains", () => {
    const cause = new Error("root cause");
    const err = new Error("outer error", { cause });
    expect(traverseErrorChain(err)).toEqual(["outer error", "root cause"]);
  });

  it("deduplicates repeated messages", () => {
    const cause = new Error("same message");
    const err = new Error("same message", { cause });
    expect(traverseErrorChain(err)).toEqual(["same message"]);
  });

  it("handles non-Error objects with message property", () => {
    const obj = { message: "object error" };
    expect(traverseErrorChain(obj)).toEqual(["object error"]);
  });

  it("handles null/undefined input", () => {
    expect(traverseErrorChain(null)).toEqual([]);
    expect(traverseErrorChain(undefined)).toEqual([]);
  });

  it("stops at max depth of 6", () => {
    let current: Error = new Error("level 0");
    for (let i = 1; i <= 10; i++) {
      current = new Error(`level ${i}`, { cause: current });
    }
    const messages = traverseErrorChain(current);
    expect(messages.length).toBeLessThanOrEqual(6);
  });
});

describe("formatErrorChain utility", () => {
  it("joins messages with colon separator", () => {
    const cause = new Error("root cause");
    const err = new Error("outer error", { cause });
    expect(formatErrorChain(err)).toBe("outer error: root cause");
  });

  it("returns string representation for non-Error input", () => {
    expect(formatErrorChain("plain string")).toBe("plain string");
  });

  it("returns empty string representation for null", () => {
    expect(formatErrorChain(null)).toBe("null");
  });
});
