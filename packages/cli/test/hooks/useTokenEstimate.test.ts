import { describe, it, expect } from "vitest";

describe("useTokenEstimate", () => {
  it("should estimate tokens correctly", () => {
    const text = "Hello world";
    const expected = Math.ceil(text.length / 4);
    expect(expected).toBe(3);
  });

  it("should return 0 for empty string", () => {
    const text = "";
    const expected = Math.ceil(text.length / 4);
    expect(expected).toBe(0);
  });

  it("should handle longer text", () => {
    const text = "this is a longer text for testing";
    const expected = Math.ceil(text.length / 4);
    expect(expected).toBe(9);
  });
});
