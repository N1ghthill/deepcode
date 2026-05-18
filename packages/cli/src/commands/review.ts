import { collectSecretValues, execFileAsync, redactText } from "@deepcode/core";
import { createRuntime } from "../runtime.js";
import { resolveSessionTarget } from "../target-resolution.js";
import { writeStderrLine, writeStdoutLine } from "../stream-flush.js";

const DIFF_MAX_CHARS = 20_000;

export interface ReviewOptions {
  cwd: string;
  config?: string;
  ref?: string;
  staged?: boolean;
  file?: string;
  focus?: string[];
  provider?: string;
  model?: string;
  yes?: boolean;
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, timeoutMs: 30_000 });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execFileAsync(
    "git",
    ["rev-parse", "--is-inside-work-tree"],
    { cwd, timeoutMs: 5_000 },
  );
  return result.exitCode === 0;
}

function buildDiffArgs(options: ReviewOptions): { args: string[]; label: string } {
  if (options.staged) {
    const args = ["diff", "--cached"];
    if (options.file) args.push("--", options.file);
    return { args, label: "staged changes" };
  }
  if (options.ref) {
    const args = ["diff", options.ref];
    if (options.file) args.push("--", options.file);
    return { args, label: `diff vs ${options.ref}` };
  }
  const args = ["diff", "HEAD"];
  if (options.file) args.push("--", options.file);
  return { args, label: options.file ? `local changes in ${options.file}` : "local changes vs HEAD" };
}

function buildPrompt(diff: string, label: string, focus: string[], truncated: boolean): string {
  const focusLine =
    focus.length > 0 ? `\nFocus areas: ${focus.join(", ")}.` : "";

  const truncationNote = truncated
    ? `\n(Diff truncated at ${DIFF_MAX_CHARS} characters; some changes are not shown.)\n`
    : "";

  return [
    `Review the following local git diff (${label}).`,
    "Do not modify any files. Output the review only.",
    focusLine,
    "",
    `\`\`\`diff`,
    diff,
    `\`\`\``,
    truncationNote,
    "Produce a structured code review:",
    "1. **Summary** — what changed (inferred from the diff)",
    "2. **Issues** — bugs, security concerns, logic errors, missing error handling; quote the relevant lines",
    "3. **Suggestions** — improvements and nitpicks",
    "4. **Verdict** — Looks good / Has issues, with a one-line rationale",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export async function reviewCommand(options: ReviewOptions): Promise<void> {
  if (!(await isGitRepo(options.cwd))) {
    await writeStderrLine("error: not inside a git repository");
    process.exit(1);
  }

  const { args, label } = buildDiffArgs(options);

  let rawDiff: string;
  try {
    rawDiff = await runGit(options.cwd, args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeStderrLine(`error: ${msg}`);
    process.exit(1);
  }

  const trimmed = rawDiff.trim();
  if (!trimmed) {
    await writeStdoutLine(`No changes to review (${label}).`);
    return;
  }

  let diff = trimmed;
  let truncated = false;
  if (diff.length > DIFF_MAX_CHARS) {
    diff = diff.slice(0, DIFF_MAX_CHARS);
    truncated = true;
  }

  const runtime = await createRuntime({
    cwd: options.cwd,
    configPath: options.config,
    interactive: Boolean(options.yes),
  });

  if (options.yes) {
    runtime.events.on("approval:request", (request) => {
      runtime.events.emit("approval:decision", {
        requestId: request.id,
        decision: { allowed: true },
      });
    });
  }

  const target = resolveSessionTarget(runtime.config, {
    provider: options.provider,
    model: options.model,
  });

  const session = runtime.sessions.create({
    provider: target.provider,
    model: target.model,
  });

  const prompt = buildPrompt(diff, label, options.focus ?? [], truncated);
  const secretValues = collectSecretValues(runtime.config);

  await writeStdoutLine(`Reviewing ${label}…\n`);

  let streamed = false;
  try {
    const output = await runtime.agent.run({
      session,
      input: prompt,
      mode: "plan",
      provider: target.provider,
      onChunk: (text) => {
        streamed = true;
        process.stdout.write(redactText(text, secretValues));
      },
    });
    if (!streamed && output) {
      process.stdout.write(redactText(output, secretValues));
    }
    if (!streamed || !output) process.stdout.write("\n");
  } finally {
    await runtime.sessions.persist(session.id).catch(() => {});
  }
}
