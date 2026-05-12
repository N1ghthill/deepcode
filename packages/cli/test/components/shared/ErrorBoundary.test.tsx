import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ErrorBoundary } from "../../../src/tui/components/shared/ErrorBoundary.js";
import { getTheme } from "../../../src/tui/themes.js";

describe("ErrorBoundary", () => {
  const theme = getTheme("dark");
  
  it("should render children when there is no error", () => {
    const { lastFrame } = render(
      React.createElement(
        ErrorBoundary,
        { theme },
        React.createElement("div", null, "Test content")
      )
    );
    
    expect(lastFrame()).toContain("Test content");
  });
  
  it("should render error message when child throws", () => {
    const BadComponent = () => {
      throw new Error("Test error");
    };
    
    const { lastFrame } = render(
      React.createElement(
        ErrorBoundary,
        { theme },
        React.createElement(BadComponent)
      )
    );
    
    expect(lastFrame()).toContain("Component error");
    expect(lastFrame()).toContain("Test error");
  });
  
  it("should show reset message when onReset is provided", () => {
    const BadComponent = () => {
      throw new Error("Test error");
    };
    
    const { lastFrame } = render(
      React.createElement(
        ErrorBoundary,
        { theme, onReset: () => {} },
        React.createElement(BadComponent)
      )
    );
    
    expect(lastFrame()).toContain("Press 'r' to try again");
  });
});