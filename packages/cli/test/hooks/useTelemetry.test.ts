import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import type { TelemetryCollector } from "@deepcode/core";
import { useTelemetry } from "../../src/tui/hooks/useTelemetry.js";

function createMockStats(overrides?: Record<string, unknown>) {
  return {
    sessionId: "sess_test",
    provider: "openrouter" as const,
    model: "model-x",
    inputTokens: 1000,
    outputTokens: 500,
    estimatedCost: 0.02,
    toolCalls: 3,
    duration: 5000,
    startTime: new Date().toISOString(),
    ...overrides,
  };
}

function createMockCollector(stats: ReturnType<typeof createMockStats> | null = null) {
  return {
    getSessionStats: vi.fn().mockReturnValue(stats),
    getSessionToolBreakdown: vi.fn().mockReturnValue({ bash: 5, file_read: 3 }),
    getAllSessionStats: vi.fn().mockReturnValue(stats ? [stats] : []),
  };
}

function TestComponent({
  sessionId,
  collector,
}: {
  sessionId: string;
  collector: ReturnType<typeof createMockCollector> | null;
}) {
  const telemetry = useTelemetry(sessionId, collector as unknown as TelemetryCollector | null);

  return React.createElement(Text, null,
    `in:${telemetry.inputTokens} out:${telemetry.outputTokens} cost:${telemetry.estimatedCost} calls:${telemetry.toolCalls} duration:${telemetry.duration} has-stats:${telemetry.stats !== null}`,
  );
}

async function settleInk() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("useTelemetry", () => {
  it("returns zeros when collector is null", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_1", collector: null }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("in:0");
      expect(frame).toContain("out:0");
      expect(frame).toContain("cost:0");
      expect(frame).toContain("calls:0");
      expect(frame).toContain("has-stats:false");
    } finally {
      unmount();
    }
  });

  it("returns zeros when collector has no stats for session", async () => {
    const collector = createMockCollector(null);
    const { lastFrame, unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_1", collector }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("in:0");
      expect(frame).toContain("has-stats:false");
    } finally {
      unmount();
    }
  });

  it("returns stats when collector has data", async () => {
    const stats = createMockStats();
    const collector = createMockCollector(stats);
    const { lastFrame, unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_test", collector }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("in:1000");
      expect(frame).toContain("out:500");
      expect(frame).toContain("cost:0.02");
      expect(frame).toContain("calls:3");
      expect(frame).toContain("duration:5000");
      expect(frame).toContain("has-stats:true");
    } finally {
      unmount();
    }
  });

  it("sets up polling interval of 2 seconds", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const stats = createMockStats();
    const collector = createMockCollector(stats);

    const { unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_test", collector }),
    );

    await settleInk();

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy.mock.calls[0][1]).toBe(2000);

    setIntervalSpy.mockRestore();
    unmount();
  });

  it("calls getSessionStats on mount", async () => {
    const stats = createMockStats();
    const collector = createMockCollector(stats);

    const { unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_test", collector }),
    );

    await settleInk();
    expect(collector.getSessionStats).toHaveBeenCalledWith("sess_test");
    unmount();
  });

  it("cleans up interval on unmount", async () => {
    const stats = createMockStats();
    const collector = createMockCollector(stats);

    const { unmount } = render(
      React.createElement(TestComponent, { sessionId: "sess_test", collector }),
    );

    await settleInk();

    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    unmount();
    await settleInk();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
