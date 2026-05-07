export interface WorkflowContext<TState = Record<string, unknown>> {
  state: TState;
  signal?: AbortSignal;
}

export interface WorkflowStep<TState = Record<string, unknown>, TResult = unknown> {
  name: string;
  execute(context: WorkflowContext<TState>): Promise<TResult>;
}

export interface WorkflowStepResult<TResult = unknown> {
  step: string;
  result: TResult;
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly step: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class ChainWorkflow<TState = Record<string, unknown>> {
  constructor(private readonly steps: Array<WorkflowStep<TState>>) {}

  async execute(context: WorkflowContext<TState>): Promise<Array<WorkflowStepResult>> {
    const results: Array<WorkflowStepResult> = [];
    for (const step of this.steps) {
      ensureNotAborted(context.signal);
      try {
        results.push({ step: step.name, result: await step.execute(context) });
      } catch (error) {
        throw new WorkflowError(`Workflow step failed: ${step.name}`, step.name, error);
      }
    }
    return results;
  }
}

export class ParallelWorkflow<TState = Record<string, unknown>> {
  constructor(private readonly steps: Array<WorkflowStep<TState>>) {}

  async execute(context: WorkflowContext<TState>): Promise<Array<WorkflowStepResult>> {
    ensureNotAborted(context.signal);
    return Promise.all(
      this.steps.map(async (step) => {
        try {
          return { step: step.name, result: await step.execute(context) };
        } catch (error) {
          throw new WorkflowError(`Workflow step failed: ${step.name}`, step.name, error);
        }
      }),
    );
  }
}

export interface Evaluation {
  isGoodEnough: boolean;
  feedback?: string;
}

export interface EvaluatorOptimizer<TInput, TOutput> {
  generate(input: TInput, feedback?: string): Promise<TOutput>;
  evaluate(output: TOutput): Promise<Evaluation>;
}

export class EvaluatorOptimizerWorkflow<TInput, TOutput> {
  constructor(
    private readonly worker: EvaluatorOptimizer<TInput, TOutput>,
    private readonly maxIterations = 5,
  ) {}

  async execute(input: TInput, signal?: AbortSignal): Promise<TOutput> {
    let feedback: string | undefined;
    let current: TOutput | undefined;
    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      ensureNotAborted(signal);
      current = await this.worker.generate(input, feedback);
      const evaluation = await this.worker.evaluate(current);
      if (evaluation.isGoodEnough) {
        return current;
      }
      feedback = evaluation.feedback;
    }
    if (current === undefined) {
      throw new WorkflowError("Evaluator optimizer did not run", "evaluator_optimizer");
    }
    return current;
  }
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new WorkflowError("Workflow aborted", "abort", signal.reason);
  }
}
