import type { Issue, PullRequest } from "@deepcode/shared";
import { execFileAsync } from "../tools/process.js";

export interface GitHubClientOptions {
  token?: string;
  enterpriseUrl?: string;
  worktree: string;
}

export class GitHubClient {
  private readonly apiBase: string;

  constructor(private readonly options: GitHubClientOptions) {
    this.apiBase = options.enterpriseUrl ? `${options.enterpriseUrl.replace(/\/$/, "")}/api/v3` : "https://api.github.com";
  }

  async listIssues(input: { owner: string; repo: string; state?: "open" | "closed" | "all" }): Promise<Issue[]> {
    const data = await this.request<any[]>(
      `/repos/${input.owner}/${input.repo}/issues?state=${input.state ?? "open"}`,
    );
    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        url: issue.html_url,
      }));
  }

  async getIssue(input: { owner: string; repo: string; number: number }): Promise<Issue> {
    const issue = await this.request<any>(`/repos/${input.owner}/${input.repo}/issues/${input.number}`);
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      url: issue.html_url,
    };
  }

  async createPullRequest(input: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<PullRequest> {
    const pr = await this.request<any>(`/repos/${input.owner}/${input.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: input.head,
        base: input.base,
      }),
    });
    return { number: pr.number, title: pr.title, state: pr.state, url: pr.html_url };
  }

  async addIssueComment(input: { owner: string; repo: string; number: number; body: string }): Promise<void> {
    await this.request(`/repos/${input.owner}/${input.repo}/issues/${input.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: input.body }),
    });
  }

  async detectRepo(): Promise<{ owner: string; repo: string }> {
    const result = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: this.options.worktree,
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || "Unable to read git origin remote");
    }
    return parseGitHubRemote(result.stdout.trim());
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.options.token) {
      throw new Error("GitHub token is required. Set GITHUB_TOKEN or .deepcode/config.json github.token.");
    }
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.options.token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status} ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

export function parseGitHubRemote(remote: string): { owner: string; repo: string } {
  const https = remote.match(/^https:\/\/[^/]+\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (https) return { owner: https[1]!, repo: https[2]! };
  const ssh = remote.match(/^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1]!, repo: ssh[2]! };
  throw new Error(`Unsupported GitHub remote URL: ${remote}`);
}
