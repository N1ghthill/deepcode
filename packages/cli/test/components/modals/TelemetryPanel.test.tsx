import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TelemetryPanel } from "../../../src/tui/components/modals/TelemetryPanel.js";
import { getTheme } from "../../../src/tui/themes.js";

const theme = getTheme("dark");

function createStats(overrides?: Record<string, unknown>) {
  return {
    sessionId: "sess_test_12345",
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

describe("TelemetryPanel", () => {
  it("shows placeholder when stats is null", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats: null }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Nenhuma estatística disponível para esta sessão.");
    } finally {
      unmount();
    }
  });

  it("renders session id, provider and model", async () => {
    const stats = createStats();
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Provider: openrouter");
      expect(frame).toContain("Modelo: qwen/qwen3-coder");
    } finally {
      unmount();
    }
  });

  it("shows token usage with input, output and total", async () => {
    const stats = createStats({ inputTokens: 15000, outputTokens: 3200 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("15.0k");
      expect(frame).toContain("3.2k");
      expect(frame).toContain("18.2k");
    } finally {
      unmount();
    }
  });

  it("shows estimated cost", async () => {
    const stats = createStats({ estimatedCost: 0.085 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("$0.0850");
    } finally {
      unmount();
    }
  });

  it("shows tool call count", async () => {
    const stats = createStats({ toolCalls: 12 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Total: 12");
    } finally {
      unmount();
    }
  });

  it("shows duration in minutes and seconds", async () => {
    const stats = createStats({ duration: 125000 });
    const { lastFrame, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats }),
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("2m 5s");
    } finally {
      unmount();
    }
  });

  it("calls onExport when pressing E", async () => {
    const onExport = vi.fn(async () => {});
    const stats = createStats();
    const { stdin, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats, onExport }),
    );

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();

      expect(onExport).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it("calls onClose when pressing escape", async () => {
    const onClose = vi.fn();
    const stats = createStats();
    const { stdin, unmount } = render(
      React.createElement(TelemetryPanel, { theme, stats, onClose }),
    );

    try {
      await settleInk();
      stdin.write("\u001b");
      await settleInk();

      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it("does not call onExport when exportStatus is exporting", async () => {
    const onExport = vi.fn(async () => {});
    const stats = createStats();
    const { stdin, unmount } = render(
      React.createElement(TelemetryPanel, {
        theme,
        stats,
        onExport,
        exportStatus: "exporting",
      }),
    );

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();

      expect(onExport).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  it("shows export status messages", async () => {
    const stats = createStats();

    const { unmount: unmountIdle } = render(
      React.createElement(TelemetryPanel, { theme, stats, exportStatus: "idle" }),
    );
    try {
      await settleInk();
      unmountIdle();
    } finally {
      // already unmounted
    }

    const cases: Array<{ status: "exporting" | "success" | "error"; expected: string }> = [
      { status: "exporting", expected: "Exportando..." },
      { status: "success", expected: "Exportado para:" },
      { status: "error", expected: "Erro ao exportar" },
    ];

    for (const { status, expected } of cases) {
      const { lastFrame, unmount } = render(
        React.createElement(TelemetryPanel, {
          theme,
          stats,
          exportStatus: status,
          lastExportPath: status === "success" ? "/tmp/export.json" : null,
        }),
      );

      try {
        await settleInk();
        const frame = lastFrame() ?? "";
        expect(frame).toContain(expected);
      } finally {
        unmount();
      }
    }
  });
});
