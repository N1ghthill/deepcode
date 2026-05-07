import { execFileAsync, GitHubClient } from "@deepcode/core";
import { createRuntime } from "../runtime.js";

export async function listIssuesCommand(options: { cwd: string; config?: string; state?: "open" | "closed" | "all" }): Promise<void> {
  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: false });
  const client = new GitHubClient({
    token: runtime.config.github.token,
    enterpriseUrl: runtime.config.github.enterpriseUrl,
    worktree: options.cwd,
  });
  const repo = await client.detectRepo();
  const issues = await client.listIssues({ ...repo, state: options.state });
  for (const issue of issues) {
    console.log(`#${issue.number} ${issue.state} ${issue.title}`);
    console.log(issue.url);
  }
}

export async function createPrCommand(
  input: { title: string; body: string; head: string; base: string },
  options: { cwd: string; config?: string },
): Promise<void> {
  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: false });
  const client = new GitHubClient({
    token: runtime.config.github.token,
    enterpriseUrl: runtime.config.github.enterpriseUrl,
    worktree: options.cwd,
  });
  const repo = await client.detectRepo();
  const pr = await client.createPullRequest({ ...repo, ...input });
  console.log(`#${pr.number} ${pr.title}`);
  console.log(pr.url);
}

export async function solveIssueCommand(
  issueNumber: number,
  options: { cwd: string; config?: string; base?: string; yes?: boolean },
): Promise<void> {
  if (!options.yes) {
    throw new Error("github solve performs commit, push, and PR creation. Re-run with --yes to approve this workflow.");
  }

  const runtime = await createRuntime({ cwd: options.cwd, configPath: options.config, interactive: true });
  runtime.events.on("approval:request", (request) => {
    runtime.events.emit("approval:decision", {
      requestId: request.id,
      decision: { allowed: true, reason: "Approved by github solve --yes" },
    });
  });

  const client = new GitHubClient({
    token: runtime.config.github.token,
    enterpriseUrl: runtime.config.github.enterpriseUrl,
    worktree: options.cwd,
  });
  const repo = await client.detectRepo();
  const issue = await client.getIssue({ ...repo, number: issueNumber });
  const base = options.base ?? "main";
  const branch = `deepcode/issue-${issueNumber}-${slugify(issue.title)}`.slice(0, 80);

  await runGit(options.cwd, ["fetch", "origin", base]);
  await runGit(options.cwd, ["checkout", "-B", branch, `origin/${base}`]);

  const session = runtime.sessions.create({
    provider: runtime.config.defaultProvider,
    model: runtime.config.defaultModel,
  });
  const prompt = [
    `Resolva a issue GitHub #${issue.number}: ${issue.title}`,
    "",
    issue.body ?? "",
    "",
    "Requisitos:",
    "- Inspecione o código relevante antes de editar.",
    "- Implemente a correção completa.",
    "- Adicione ou atualize testes quando fizer sentido.",
    "- Execute validações adequadas.",
  ].join("\n");

  process.stdout.write(`Solving issue #${issue.number} on ${branch}\n`);
  await runtime.agent.run({
    session,
    input: prompt,
    onChunk: (text) => process.stdout.write(text),
  });
  process.stdout.write("\n");

  const status = await runGit(options.cwd, ["status", "--porcelain"]);
  if (!status.stdout.trim()) {
    throw new Error("Agent completed without file changes; no PR was created.");
  }

  await runGit(options.cwd, ["add", "."]);
  await runGit(options.cwd, [
    "commit",
    "-m",
    `fix: resolve issue #${issue.number}`,
    "-m",
    `${issue.title}\n\nCloses #${issue.number}`,
  ]);
  await runGit(options.cwd, ["push", "-u", "origin", branch]);

  const pr = await client.createPullRequest({
    ...repo,
    title: `Fix: ${issue.title}`,
    body: [
      `Resolves #${issue.number}.`,
      "",
      "Implemented by DeepCode.",
      "",
      `Session: ${session.id}`,
    ].join("\n"),
    head: branch,
    base,
  });
  await client.addIssueComment({
    ...repo,
    number: issue.number,
    body: `DeepCode opened PR #${pr.number}: ${pr.url}`,
  });
  console.log(`PR created: ${pr.url}`);
}

async function runGit(cwd: string, args: string[]) {
  const result = await execFileAsync("git", args, { cwd, timeoutMs: 180_000 });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}
