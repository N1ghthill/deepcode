import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import type { ModelInfo, ProviderId } from "@deepcode/shared";
import {
  useModels,
  useModelCatalog,
  clearModelCache,
  type ModelCatalogProviderEntry,
} from "../../src/tui/hooks/useModels.js";
import { settleInk } from "../settle-ink.js";

// --- helpers ---

function makeModel(id: string, name: string, provider: ProviderId = "openrouter"): ModelInfo {
  return { id, name, provider, contextLength: undefined, capabilities: undefined, pricing: undefined };
}

function makeProvider(models: ModelInfo[], opts?: { fail?: boolean }) {
  return {
    listModels: vi.fn(async () => {
      if (opts?.fail) {
        throw new Error("provider unavailable");
      }
      return models;
    }),
  };
}

// --- useModels component wrapper ---

function ModelsDisplay({
  providerId,
  provider,
}: {
  providerId: ProviderId;
  provider: ReturnType<typeof makeProvider> | null;
}) {
  const { models, loading, error } = useModels(providerId, provider);
  return React.createElement(
    Text,
    null,
    `loading:${loading} count:${models.length} error:${error ?? "none"} ids:${models.map((m) => m.id).join(",")}`,
  );
}

// --- useModelCatalog component wrapper ---

function CatalogDisplay({ entries }: { entries: ModelCatalogProviderEntry[] }) {
  const { models, loading, error, providerErrors } = useModelCatalog(entries);
  const errKeys = Object.keys(providerErrors).join(",");
  return React.createElement(
    Text,
    null,
    `loading:${loading} count:${models.length} error:${error ?? "none"} provErr:${errKeys || "none"} ids:${models.map((m) => m.id).join(",")}`,
  );
}

beforeEach(() => {
  clearModelCache();
});

// ──────────────────────────────────────────────────────────────────────────────
// useModels
// ──────────────────────────────────────────────────────────────────────────────

describe("useModels", () => {
  it("sets error immediately when provider is null", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(ModelsDisplay, { providerId: "openrouter", provider: null }),
    );

    try {
      await settleInk();
      expect(lastFrame()).toContain("loading:false");
      expect(lastFrame()).toContain("count:0");
      expect(lastFrame()).not.toContain("error:none");
    } finally {
      unmount();
    }
  });

  it("populates models on successful fetch", async () => {
    const models = [makeModel("m1", "Model One"), makeModel("m2", "Model Two")];
    const provider = makeProvider(models);

    const { lastFrame, unmount } = render(
      React.createElement(ModelsDisplay, { providerId: "openrouter", provider }),
    );

    try {
      await settleInk(50);
      expect(lastFrame()).toContain("loading:false");
      expect(lastFrame()).toContain("count:2");
      expect(lastFrame()).toContain("error:none");
      expect(lastFrame()).toContain("ids:m1,m2");
    } finally {
      unmount();
    }
  });

  it("sets error on provider failure", async () => {
    const provider = makeProvider([], { fail: true });

    const { lastFrame, unmount } = render(
      React.createElement(ModelsDisplay, { providerId: "openrouter", provider }),
    );

    try {
      await settleInk(50);
      expect(lastFrame()).toContain("loading:false");
      expect(lastFrame()).toContain("count:0");
      expect(lastFrame()).toContain("provider unavailable");
    } finally {
      unmount();
    }
  });

  it("uses cached result for same providerId without calling listModels again", async () => {
    const models = [makeModel("m1", "Model One")];
    const provider = makeProvider(models);

    const { unmount: u1 } = render(
      React.createElement(ModelsDisplay, { providerId: "anthropic", provider }),
    );
    await settleInk(50);
    u1();

    const { lastFrame, unmount: u2 } = render(
      React.createElement(ModelsDisplay, { providerId: "anthropic", provider }),
    );

    try {
      await settleInk(50);
      expect(provider.listModels).toHaveBeenCalledTimes(1);
      expect(lastFrame()).toContain("count:1");
    } finally {
      u2();
    }
  });

  it("refetches after refresh clears cache", async () => {
    const models = [makeModel("m1", "Model One")];
    const provider = makeProvider(models);
    let refreshFn: (() => void) | undefined;

    function ModelsWithRefresh() {
      const { models: ms, loading, refresh } = useModels("openai", provider);
      refreshFn = refresh;
      return React.createElement(Text, null, `loading:${loading} count:${ms.length}`);
    }

    const { unmount } = render(React.createElement(ModelsWithRefresh));
    await settleInk(50);
    expect(provider.listModels).toHaveBeenCalledTimes(1);

    refreshFn?.();
    await settleInk(50);
    expect(provider.listModels).toHaveBeenCalledTimes(2);
    unmount();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// useModelCatalog
// ──────────────────────────────────────────────────────────────────────────────

describe("useModelCatalog", () => {
  it("returns error when no enabled entries", async () => {
    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries: [] }),
    );

    try {
      await settleInk();
      expect(lastFrame()).toContain("count:0");
      expect(lastFrame()).not.toContain("error:none");
    } finally {
      unmount();
    }
  });

  it("returns error when all entries are disabled", async () => {
    const entry: ModelCatalogProviderEntry = {
      id: "openrouter",
      provider: makeProvider([makeModel("m1", "M1")]),
      enabled: false,
    };

    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries: [entry] }),
    );

    try {
      await settleInk();
      expect(lastFrame()).toContain("count:0");
      expect(lastFrame()).not.toContain("error:none");
    } finally {
      unmount();
    }
  });

  it("aggregates and sorts models from multiple enabled providers", async () => {
    const entries: ModelCatalogProviderEntry[] = [
      {
        id: "openrouter",
        provider: makeProvider([makeModel("or-m1", "OR Model 1", "openrouter")]),
        enabled: true,
      },
      {
        id: "anthropic",
        provider: makeProvider([makeModel("an-m1", "AN Model 1", "anthropic")]),
        enabled: true,
      },
    ];

    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries }),
    );

    try {
      await settleInk(80);
      expect(lastFrame()).toContain("count:2");
      expect(lastFrame()).toContain("error:none");
      // sorted alphabetically by provider: anthropic before openrouter
      expect(lastFrame()).toContain("ids:an-m1,or-m1");
    } finally {
      unmount();
    }
  });

  it("captures per-provider errors while returning successful provider models", async () => {
    const entries: ModelCatalogProviderEntry[] = [
      {
        id: "openrouter",
        provider: makeProvider([makeModel("or-m1", "OR Model 1", "openrouter")]),
        enabled: true,
      },
      {
        id: "anthropic",
        provider: makeProvider([], { fail: true }),
        enabled: true,
      },
    ];

    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries }),
    );

    try {
      await settleInk(80);
      expect(lastFrame()).toContain("count:1");
      expect(lastFrame()).toContain("provErr:anthropic");
      expect(lastFrame()).toContain("ids:or-m1");
    } finally {
      unmount();
    }
  });

  it("sets top-level error when all providers fail", async () => {
    const entries: ModelCatalogProviderEntry[] = [
      {
        id: "openrouter",
        provider: makeProvider([], { fail: true }),
        enabled: true,
      },
    ];

    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries }),
    );

    try {
      await settleInk(80);
      expect(lastFrame()).toContain("count:0");
      expect(lastFrame()).not.toContain("error:none");
      expect(lastFrame()).toContain("provErr:openrouter");
    } finally {
      unmount();
    }
  });

  it("uses cache — listModels not called twice for the same provider", async () => {
    const provider = makeProvider([makeModel("m1", "M1", "groq")]);
    const entry: ModelCatalogProviderEntry = { id: "groq", provider, enabled: true };

    const { unmount: u1 } = render(
      React.createElement(CatalogDisplay, { entries: [entry] }),
    );
    await settleInk(80);
    u1();

    const { lastFrame, unmount: u2 } = render(
      React.createElement(CatalogDisplay, { entries: [entry] }),
    );

    try {
      await settleInk(80);
      expect(provider.listModels).toHaveBeenCalledTimes(1);
      expect(lastFrame()).toContain("count:1");
    } finally {
      u2();
    }
  });

  it("skips disabled entries even when provider is set", async () => {
    const entries: ModelCatalogProviderEntry[] = [
      {
        id: "openrouter",
        provider: makeProvider([makeModel("m1", "M1", "openrouter")]),
        enabled: false,
      },
      {
        id: "anthropic",
        provider: makeProvider([makeModel("m2", "M2", "anthropic")]),
        enabled: true,
      },
    ];

    const { lastFrame, unmount } = render(
      React.createElement(CatalogDisplay, { entries }),
    );

    try {
      await settleInk(80);
      expect(lastFrame()).toContain("count:1");
      expect(lastFrame()).toContain("ids:m2");
    } finally {
      unmount();
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// clearModelCache
// ──────────────────────────────────────────────────────────────────────────────

describe("clearModelCache", () => {
  it("forces a fresh listModels call after clearing", async () => {
    const models = [makeModel("m1", "M1")];
    const provider = makeProvider(models);

    const { unmount: u1 } = render(
      React.createElement(ModelsDisplay, { providerId: "openai", provider }),
    );
    await settleInk(50);
    u1();

    clearModelCache();

    const { unmount: u2 } = render(
      React.createElement(ModelsDisplay, { providerId: "openai", provider }),
    );
    await settleInk(50);
    u2();

    expect(provider.listModels).toHaveBeenCalledTimes(2);
  });
});
