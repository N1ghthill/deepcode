import { describe, expect, it } from "vitest";
import { SessionBudget } from "../src/agent/token-budget.js";

describe("SessionBudget", () => {
  it("returns ok when nothing has been used", () => {
    const budget = new SessionBudget({ warnAtFraction: 0.8 });
    expect(budget.check()).toEqual({ status: "ok" });
  });

  it("returns ok when no limits are configured", () => {
    const budget = new SessionBudget({ warnAtFraction: 0.8 });
    budget.add(100_000, 50_000);
    expect(budget.check()).toEqual({ status: "ok" });
  });

  it("returns exceeded when input tokens limit is hit", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, warnAtFraction: 0.8 });
    budget.add(1000, 0);
    const result = budget.check();
    expect(result.status).toBe("exceeded");
    expect((result as { kind: string }).kind).toBe("inputTokens");
  });

  it("returns exceeded when output tokens limit is hit", () => {
    const budget = new SessionBudget({ maxOutputTokens: 500, warnAtFraction: 0.8 });
    budget.add(0, 600);
    const result = budget.check();
    expect(result.status).toBe("exceeded");
    expect((result as { kind: string }).kind).toBe("outputTokens");
  });

  it("returns warning when approaching input token limit", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, warnAtFraction: 0.8 });
    budget.add(850, 0);
    const result = budget.check();
    expect(result.status).toBe("warning");
    expect((result as { kind: string }).kind).toBe("inputTokens");
  });

  it("emits warning only once per kind", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, warnAtFraction: 0.8 });
    budget.add(850, 0);
    expect(budget.check().status).toBe("warning");
    expect(budget.check().status).toBe("ok"); // second check: warning already emitted
  });

  it("exceeded takes priority over warning", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, maxOutputTokens: 500, warnAtFraction: 0.8 });
    budget.add(1100, 450); // input exceeded, output near warning
    expect(budget.check().status).toBe("exceeded");
  });

  it("tracks cost via rough estimate", () => {
    const budget = new SessionBudget({ maxCostUsd: 0.01, warnAtFraction: 0.8 });
    budget.add(1000, 500); // ~$0.003 + ~$0.006 = ~$0.009
    expect(budget.totals.costUsd).toBeGreaterThan(0);
    expect(budget.totals.costUsd).toBeLessThan(0.02);
  });

  it("isExceeded returns false when under limits", () => {
    const budget = new SessionBudget({ maxInputTokens: 10_000, warnAtFraction: 0.8 });
    budget.add(5000, 0);
    expect(budget.isExceeded()).toBe(false);
  });

  it("isExceeded returns true when over limit", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, warnAtFraction: 0.8 });
    budget.add(1001, 0);
    expect(budget.isExceeded()).toBe(true);
  });

  it("accumulates across multiple add() calls", () => {
    const budget = new SessionBudget({ maxInputTokens: 1000, warnAtFraction: 0.8 });
    budget.add(400, 0);
    budget.add(400, 0);
    budget.add(300, 0); // total 1100
    expect(budget.isExceeded()).toBe(true);
    expect(budget.totals.inputTokens).toBe(1100);
  });
});
