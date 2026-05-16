import { describe, expect, it } from "vitest";
import {
  getScopedProviderStatus,
  isProviderStatusCurrent,
  isProviderStatusStale,
  type ProviderStatus,
} from "../../src/tui/hooks/useProviderStatus.js";

function createStatus(overrides?: Partial<ProviderStatus>): ProviderStatus {
  return {
    online: false,
    latency: 10,
    error: null,
    lastChecked: new Date("2026-05-09T22:32:00Z"),
    checkedTarget: null,
    ...overrides,
  };
}

describe("useProviderStatus helpers", () => {
  it("treats a matching model target as current", () => {
    const status = createStatus({
      online: true,
      checkedTarget: "deepseek/deepseek-v4-flash",
    });

    expect(isProviderStatusCurrent(status, "deepseek/deepseek-v4-flash")).toBe(true);
    expect(isProviderStatusStale(status, "deepseek/deepseek-v4-flash")).toBe(false);
    expect(getScopedProviderStatus(status, "deepseek/deepseek-v4-flash")).toEqual(status);
  });

  it("treats an old model target as stale", () => {
    const status = createStatus({
      error: "Model not found",
      checkedTarget: "deepseek/deepseek-v4-pro",
    });

    expect(isProviderStatusCurrent(status, "deepseek/deepseek-v4-flash")).toBe(false);
    expect(isProviderStatusStale(status, "deepseek/deepseek-v4-flash")).toBe(true);
    expect(getScopedProviderStatus(status, "deepseek/deepseek-v4-flash")).toBeUndefined();
  });
});
