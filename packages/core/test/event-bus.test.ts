import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/events/event-bus.js";

describe("EventBus", () => {
  it('does not throw when emitting "app:error" without user listeners', () => {
    const bus = new EventBus();

    expect(() => {
      bus.emit("app:error", { error: new Error("tool failure"), context: { tool: "bash" } });
    }).not.toThrow();
  });

  it('still delivers "app:error" events to registered listeners', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    bus.on("app:error", listener);

    const payload = { error: new Error("tool failure"), context: { tool: "bash" } };
    bus.emit("app:error", payload);

    expect(listener).toHaveBeenCalledWith(payload);
  });
});
