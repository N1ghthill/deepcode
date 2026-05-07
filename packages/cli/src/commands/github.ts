import { GitHubClient } from "@deepcode/core";
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
