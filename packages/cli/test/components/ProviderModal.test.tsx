import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import type { ProviderId } from "@deepcode/shared";
import { ProviderModal } from "../../src/tui/components/modals/ProviderModal.js";
import { getTheme } from "../../src/tui/themes.js";

const theme = getTheme("dark");

async function settleInk() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createProviders() {
  return [
    {
      id: "openrouter" as ProviderId,
      name: "OpenRouter",
      status: {
        online: false,
        latency: null,
        error: null,
        lastChecked: null,
        checkedTarget: null,
      },
      hasApiKey: false,
      hasApiKeyFile: false,
    },
  ];
}

function renderModal(overrides?: {
  onUpdateApiKey?: (providerId: ProviderId, apiKey: string) => Promise<void>;
}) {
  return render(
    <ProviderModal
      theme={theme}
      currentProvider="openrouter"
      providers={createProviders()}
      onClose={() => {}}
      onTestConnection={async () => {}}
      onSelectProvider={async () => {}}
      onUpdateApiKey={overrides?.onUpdateApiKey ?? (async () => {})}
    />,
  );
}

describe("ProviderModal", () => {
  it("accepts pasted API keys in a single input event", async () => {
    const onUpdateApiKey = vi.fn(async () => {});
    const { stdin, unmount } = renderModal({ onUpdateApiKey });

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();
      stdin.write("\u001b[200~sk-test-key\r\n\u001b[201~");
      await settleInk();
      stdin.write("\r");
      await settleInk();

      expect(onUpdateApiKey).toHaveBeenCalledWith("openrouter", "sk-test-key");
    } finally {
      unmount();
    }
  });

  it("allows typing the letter t into API keys", async () => {
    const onUpdateApiKey = vi.fn(async () => {});
    const { stdin, unmount } = renderModal({ onUpdateApiKey });

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();
      stdin.write("t");
      await settleInk();
      stdin.write("\r");
      await settleInk();

      expect(onUpdateApiKey).toHaveBeenCalledWith("openrouter", "t");
    } finally {
      unmount();
    }
  });

  it("toggles API key visibility with Ctrl+T", async () => {
    const { stdin, lastFrame, unmount } = renderModal();

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();
      stdin.write("abc");
      await settleInk();
      expect(lastFrame()).toContain("•••");

      stdin.write("\u0014");
      await settleInk();
      expect(lastFrame()).toContain("abc");
    } finally {
      unmount();
    }
  });

  it("waits for API key save to finish before allowing a connection test", async () => {
    let resolveSave: (() => void) | undefined;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onUpdateApiKey = vi.fn(async () => savePromise);
    const onTestConnection = vi.fn(async () => {});
    const { stdin, lastFrame, unmount } = render(
      <ProviderModal
        theme={theme}
        currentProvider="openrouter"
        providers={createProviders()}
        onClose={() => {}}
        onTestConnection={onTestConnection}
        onSelectProvider={async () => {}}
        onUpdateApiKey={onUpdateApiKey}
      />,
    );

    try {
      await settleInk();
      stdin.write("e");
      await settleInk();
      stdin.write("sk-test-key");
      await settleInk();
      stdin.write("\r");
      await settleInk();

      expect(onUpdateApiKey).toHaveBeenCalledWith("openrouter", "sk-test-key");
      expect(lastFrame()).toContain("saving");

      stdin.write("\r");
      await settleInk();
      expect(onTestConnection).not.toHaveBeenCalled();

      resolveSave?.();
      await settleInk();
      await settleInk();

      stdin.write("\r");
      await settleInk();
      expect(onTestConnection).toHaveBeenCalledWith("openrouter");
    } finally {
      unmount();
    }
  });

  it("does not show a stale model error as the current provider state", async () => {
    const { lastFrame, unmount } = render(
      <ProviderModal
        theme={theme}
        currentProvider="deepseek"
        providers={[
          {
            id: "deepseek",
            name: "DeepSeek",
            status: {
              online: false,
              latency: 123,
              error: "Model not found for DeepSeek: deepseek/deepseek-v4-pro",
              lastChecked: new Date("2026-05-09T22:32:00Z"),
              checkedTarget: "deepseek/deepseek-v4-pro",
            },
            hasApiKey: true,
            hasApiKeyFile: false,
            expectedTarget: "deepseek/deepseek-v4-flash",
          },
        ]}
        onClose={() => {}}
        onTestConnection={async () => {}}
        onSelectProvider={async () => {}}
        onUpdateApiKey={async () => {}}
      />,
    );

    try {
      await settleInk();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("○ stale status");
      expect(frame).toContain("Current target: deepseek/deepseek-v4-flash");
      expect(frame).toContain("Last test: deepseek/deepseek-v4-pro");
      expect(frame).toContain("Last error: Model not found for DeepSeek: deepseek/deepseek-v4-pro");
    } finally {
      unmount();
    }
  });
});
