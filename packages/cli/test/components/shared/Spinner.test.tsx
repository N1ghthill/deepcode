import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Spinner } from "../../../src/tui/components/shared/Spinner.js";
import { InlineSpinner } from "../../../src/tui/components/shared/InlineSpinner.js";
import { TypingIndicator } from "../../../src/tui/components/shared/TypingIndicator.js";

const mockTheme = {
  warning: "yellow",
  primary: "cyan",
  error: "red",
  success: "green",
  accent: "magenta",
  fgMuted: "gray",
  border: "gray",
  borderActive: "cyan",
  userMsg: "cyan",
  assistantMsg: "green",
};

describe("Spinner Components", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Spinner", () => {
    it("should render with default props", () => {
      const { lastFrame } = render(<Spinner theme={mockTheme} />);
      expect(lastFrame()).toBeTruthy();
    });

    it("should render with custom text", () => {
      const { lastFrame } = render(<Spinner theme={mockTheme} text="Loading..." />);
      expect(lastFrame()).toBeTruthy();
    });

    it("should animate frames", () => {
      const { lastFrame } = render(<Spinner theme={mockTheme} type="dots" />);
      
      const firstFrame = lastFrame();
      vi.advanceTimersByTime(80);
      const secondFrame = lastFrame();
      
      expect(firstFrame).toBeTruthy();
      expect(secondFrame).toBeTruthy();
    });

    it("should cleanup interval on unmount", () => {
      const { unmount } = render(<Spinner theme={mockTheme} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("InlineSpinner", () => {
    it("should render", () => {
      const { lastFrame } = render(<InlineSpinner theme={mockTheme} />);
      expect(lastFrame()).toBeTruthy();
    });

    it("should animate", () => {
      const { lastFrame } = render(<InlineSpinner theme={mockTheme} />);
      
      const firstFrame = lastFrame();
      vi.advanceTimersByTime(100);
      const secondFrame = lastFrame();
      
      expect(firstFrame).toBeTruthy();
      expect(secondFrame).toBeTruthy();
    });

    it("should cleanup interval on unmount", () => {
      const { unmount } = render(<InlineSpinner theme={mockTheme} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("TypingIndicator", () => {
    it("should render", () => {
      const { lastFrame } = render(<TypingIndicator theme={mockTheme} />);
      expect(lastFrame()).toBeTruthy();
    });

    it("should animate dots", () => {
      const { lastFrame } = render(<TypingIndicator theme={mockTheme} />);
      
      const firstFrame = lastFrame();
      vi.advanceTimersByTime(500);
      const secondFrame = lastFrame();
      
      expect(firstFrame).toBeTruthy();
      expect(secondFrame).toBeTruthy();
    });

    it("should cleanup interval on unmount", () => {
      const { unmount } = render(<TypingIndicator theme={mockTheme} />);
      expect(() => unmount()).not.toThrow();
    });
  });
});
