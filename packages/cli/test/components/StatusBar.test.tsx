import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { StatusBar } from "../../src/tui/components/layout/StatusBar.js";
import { getTheme } from "../../src/tui/themes.js";

const theme = getTheme("dark");

async function settleInk() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("StatusBar", () => {
  it("shows explicit plan and build routing for the TUI", async () => {
    const { lastFrame, unmount } = render(
      <StatusBar
        theme={theme}
        input=""
        streaming={false}
        status="idle"
        vimMode="insert"
        inputTokens={0}
        outputTokens={0}
        estimatedCost={0}
        toolCalls={0}
        agentMode="plan"
        planSelection={{
          provider: "deepseek",
          model: "deepseek-v4-pro",
        }}
        buildSelection={{
          provider: "openrouter",
          model: "qwen/qwen3-coder",
        }}
      />,
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("● PLAN");
      expect(frame).toContain("deepseek/deepseek-v4-pro");
      expect(frame).toContain("○ BUILD");
      expect(frame).toContain("openrouter/qwen/qwen3-coder");
    } finally {
      unmount();
    }
  });
});
