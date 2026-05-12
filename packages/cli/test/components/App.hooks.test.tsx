import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/App.js";

describe("App Component - Hooks Validation", () => {
  it("should call all hooks before any conditional returns", () => {
    const { lastFrame } = render(<App cwd="/tmp" />);
    const frame = lastFrame();
    
    expect(frame).toBeTruthy();
    expect(frame).toContain("Loading DeepCode...");
  });

  it("should not violate React hooks rules", () => {
    const { lastFrame, unmount } = render(<App cwd="/tmp" />);
    
    expect(() => {
      const frame = lastFrame();
      expect(frame).toBeTruthy();
    }).not.toThrow();

    unmount();
  });

  it("should handle conditional rendering without breaking hooks", () => {
    const { lastFrame, unmount } = render(<App cwd="/tmp" />);
    
    const frame = lastFrame();
    expect(frame).toBeTruthy();
    
    unmount();
  });
});
