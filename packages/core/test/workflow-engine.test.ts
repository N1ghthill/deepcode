import { describe, expect, it } from "vitest";
import { ChainWorkflow, EvaluatorOptimizerWorkflow, ParallelWorkflow } from "../src/workflows/workflow-engine.js";

describe("workflow engine", () => {
  it("runs chain steps in order", async () => {
    const order: string[] = [];
    const workflow = new ChainWorkflow([
      { name: "first", execute: async () => order.push("first") },
      { name: "second", execute: async () => order.push("second") },
    ]);
    await workflow.execute({ state: {} });
    expect(order).toEqual(["first", "second"]);
  });

  it("runs parallel steps", async () => {
    const workflow = new ParallelWorkflow([
      { name: "a", execute: async () => "A" },
      { name: "b", execute: async () => "B" },
    ]);
    await expect(workflow.execute({ state: {} })).resolves.toEqual([
      { step: "a", result: "A" },
      { step: "b", result: "B" },
    ]);
  });

  it("improves until evaluator accepts", async () => {
    let count = 0;
    const workflow = new EvaluatorOptimizerWorkflow<string, string>({
      generate: async (_input, feedback) => {
        count += 1;
        return feedback ? "better" : "draft";
      },
      evaluate: async (output) => ({
        isGoodEnough: output === "better",
        feedback: "improve",
      }),
    });
    await expect(workflow.execute("task")).resolves.toBe("better");
    expect(count).toBe(2);
  });
});
