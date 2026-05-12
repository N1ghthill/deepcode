import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TelemetrySidebar } from "../../../src/tui/components/shared/TelemetrySidebar.js";
import { getTheme } from "../../../src/tui/themes.js";

const theme = getTheme("dark");

function createStats(overrides?: Record<string, unknown>) {
  return {
    sessionId: "sess_1",
    provider: "openrouter" as const,
    model: "qwen/qwen3-coder",
    inputTokens: 15000,
    outputTokens: 3200,
    estimatedCost: 0.085,
    toolCalls: 12,
    duration: 125000,
    startTime: new Date().toISOString(),
    ...overrides,
  };
}

async function settleInk() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("TelemetrySidebar", () => {
  it("shows placeholder when stats is null", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats: null }),
    );

    try {
      await settleInk();
      expect(lastFrame()).toContain("No telemetry data.");
    } finally {
      unmount();
    }
  });

  it("renders provider and model", async () => {
    const stats = createStats();
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Provider: openrouter");
      expect(frame).toContain("Model: qwen/qwen3-coder");
    } finally {
      unmount();
    }
  });

  it("formats tokens with k suffix for thousands", async () => {
    const stats = createStats({ inputTokens: 15000, outputTokens: 3200 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("15.0k");
      expect(frame).toContain("3.2k");
    } finally {
      unmount();
    }
  });

  it("formats tokens with M suffix for millions", async () => {
    const stats = createStats({ inputTokens: 2500000, outputTokens: 1200000 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("2.50M");
      expect(frame).toContain("1.20M");
    } finally {
      unmount();
    }
  });

  it("formats small tokens without suffix", async () => {
    const stats = createStats({ inputTokens: 500, outputTokens: 200 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("500");
      expect(frame).toContain("200");
    } finally {
      unmount();
    }
  });

  it("formats duration in minutes and seconds", async () => {
    const stats = createStats({ duration: 125000 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("2m 5s");
    } finally {
      unmount();
    }
  });

  it("formats duration in hours and minutes", async () => {
    const stats = createStats({ duration: 7500000 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("2h 5m");
    } finally {
      unmount();
    }
  });

  it("formats duration in seconds for short sessions", async () => {
    const stats = createStats({ duration: 3000 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("3s");
    } finally {
      unmount();
    }
  });

  it("displays estimated cost", async () => {
    const stats = createStats({ estimatedCost: 0.085 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("$0.0850");
    } finally {
      unmount();
    }
  });

  it("displays tool call count", async () => {
    const stats = createStats({ toolCalls: 12 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetrySidebar, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Total: 12");
    } finally {
      unmount();
    }
  });
});
