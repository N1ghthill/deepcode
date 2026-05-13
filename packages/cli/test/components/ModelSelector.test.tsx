import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { ModelInfo } from "@deepcode/shared";
import { ModelSelector } from "../../src/tui/components/modals/ModelSelector.js";
import { getTheme } from "../../src/tui/themes.js";

const theme = getTheme("dark");

async function settleInk(ms = 20) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createModels(count: number, provider: ModelInfo["provider"] = "deepseek"): ModelInfo[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `family/model-${String(index + 1).padStart(2, "0")}`,
    name: `Model ${String(index + 1).padStart(2, "0")}`,
    provider,
    contextLength: 128_000,
    capabilities: {
      streaming: true,
      functionCalling: true,
      jsonMode: true,
      vision: false,
    },
  }));
}

describe("ModelSelector", () => {
  it("can navigate beyond the first 15 models", async () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <ModelSelector
        theme={theme}
        models={createModels(20)}
        loading={false}
        error={null}
        currentSelection={null}
        currentProvider="deepseek"
        recentSelections={[]}
        onSelect={onSelect}
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    );

    try {
      await settleInk();
      for (let index = 0; index < 16; index += 1) {
        stdin.write("\u001B[B");
        await settleInk();
      }
      stdin.write("\r");
      await settleInk();

      expect(onSelect).toHaveBeenCalledWith({
        provider: "deepseek",
        model: "family/model-17",
      });
    } finally {
      unmount();
    }
  });

  it("accepts a manual provider/model selection when the model is missing from the list", async () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <ModelSelector
        theme={theme}
        models={createModels(2)}
        loading={false}
        error={null}
        currentSelection={null}
        currentProvider="deepseek"
        recentSelections={[]}
        onSelect={onSelect}
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    );

    try {
      await settleInk();
      stdin.write("m");
      await settleInk();
      for (const char of "openrouter/moonshotai/kimi-k2") {
        stdin.write(char);
        await settleInk();
      }
      stdin.write("\r");
      await settleInk();

      expect(onSelect).toHaveBeenCalledWith({
        provider: "openrouter",
        model: "moonshotai/kimi-k2",
      });
    } finally {
      unmount();
    }
  });

  it("keeps recent models above unrelated providers", async () => {
    const onSelect = vi.fn();
    const models = [
      ...createModels(1, "deepseek"),
      ...createModels(1, "openrouter"),
    ];
    const { lastFrame, unmount } = render(
      <ModelSelector
        theme={theme}
        models={models}
        loading={false}
        error={null}
        currentSelection={null}
        currentProvider="deepseek"
        recentSelections={[
          {
            provider: "openrouter",
            model: "family/model-01",
          },
        ]}
        onSelect={onSelect}
        onRefresh={() => {}}
        onClose={() => {}}
      />,
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame.indexOf("openrouter / Model 01")).toBeLessThan(frame.indexOf("deepseek / Model 01"));
    } finally {
      unmount();
    }
  });
});
