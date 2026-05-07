import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitHubClient, parseGitHubRemote } from "../src/github/github-client.js";
import { normalizeGitHubWebBase } from "../src/github/oauth-device-flow.js";
import { execFileAsync } from "../src/tools/process.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("parseGitHubRemote", () => {
  it("parses https remotes", () => {
    expect(parseGitHubRemote("https://github.com/acme/project.git")).toEqual({
      owner: "acme",
      repo: "project",
    });
  });

  it("parses ssh remotes", () => {
    expect(parseGitHubRemote("git@github.com:acme/project.git")).toEqual({
      owner: "acme",
      repo: "project",
    });
  });

  it("normalizes GitHub OAuth web base URLs", () => {
    expect(normalizeGitHubWebBase()).toBe("https://github.com");
    expect(normalizeGitHubWebBase("https://github.company.com/")).toBe(
      "https://github.company.com",
    );
    expect(normalizeGitHubWebBase("https://github.company.com/api/v3")).toBe(
      "https://github.company.com",
    );
  });
});

describe("GitHubClient", () => {
  it("uses GitHub API contracts for issues, pull requests, comments, and auth", async () => {
    const requests: Array<{ method: string; url: string; authorization: string; body: unknown }> =
      [];
    const server = createServer(async (request, response) => {
      const body = await readJsonBody(request);
      requests.push({
        method: request.method ?? "GET",
        url: request.url ?? "",
        authorization: request.headers.authorization ?? "",
        body,
      });
      handleGitHubApi(request, response);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to bind local GitHub test server");
    }
    const enterpriseUrl = `http://127.0.0.1:${address.port}`;
    const client = new GitHubClient({
      token: "test-token",
      enterpriseUrl,
      worktree: process.cwd(),
    });

    try {
      await expect(client.getAuthenticatedUser()).resolves.toEqual({
        login: "octocat",
        id: 1,
        url: `${enterpriseUrl}/octocat`,
      });
      await expect(client.listIssues({ owner: "acme", repo: "project" })).resolves.toEqual([
        {
          number: 1,
          title: "Bug",
          body: "Broken",
          state: "open",
          url: `${enterpriseUrl}/issues/1`,
        },
      ]);
      await expect(client.getIssue({ owner: "acme", repo: "project", number: 1 })).resolves.toEqual(
        {
          number: 1,
          title: "Bug",
          body: "Broken",
          state: "open",
          url: `${enterpriseUrl}/issues/1`,
        },
      );
      await expect(
        client.createPullRequest({
          owner: "acme",
          repo: "project",
          title: "Fix",
          body: "Details",
          head: "fix-branch",
          base: "main",
        }),
      ).resolves.toEqual({
        number: 2,
        title: "Fix",
        state: "open",
        url: `${enterpriseUrl}/pull/2`,
      });
      await expect(
        client.addIssueComment({
          owner: "acme",
          repo: "project",
          number: 1,
          body: "Solved in PR",
        }),
      ).resolves.toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    expect(requests.every((request) => request.authorization === "Bearer test-token")).toBe(true);
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET /api/v3/user",
      "GET /api/v3/repos/acme/project/issues?state=open",
      "GET /api/v3/repos/acme/project/issues/1",
      "POST /api/v3/repos/acme/project/pulls",
      "POST /api/v3/repos/acme/project/issues/1/comments",
    ]);
    expect(requests[3]?.body).toEqual({
      title: "Fix",
      body: "Details",
      head: "fix-branch",
      base: "main",
    });
    expect(requests[4]?.body).toEqual({ body: "Solved in PR" });
  });

  it("detects repository coordinates from a temporary git repository", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-github-"));
    await execFileAsync("git", ["init"], { cwd: tempDir, timeoutMs: 10_000 });
    await execFileAsync("git", ["remote", "add", "origin", "git@github.com:acme/project.git"], {
      cwd: tempDir,
      timeoutMs: 10_000,
    });

    await expect(
      new GitHubClient({ token: "test-token", worktree: tempDir }).detectRepo(),
    ).resolves.toEqual({
      owner: "acme",
      repo: "project",
    });
  });
});

function handleGitHubApi(request: IncomingMessage, response: ServerResponse): void {
  const enterpriseUrl = `http://${request.headers.host}`;
  switch (`${request.method ?? "GET"} ${request.url ?? ""}`) {
    case "GET /api/v3/user":
      sendJson(response, {
        login: "octocat",
        id: 1,
        html_url: `${enterpriseUrl}/octocat`,
      });
      return;
    case "GET /api/v3/repos/acme/project/issues?state=open":
      sendJson(response, [
        {
          number: 1,
          title: "Bug",
          body: "Broken",
          state: "open",
          html_url: `${enterpriseUrl}/issues/1`,
        },
        {
          number: 2,
          title: "Existing PR",
          body: null,
          state: "open",
          html_url: `${enterpriseUrl}/pull/2`,
          pull_request: {},
        },
      ]);
      return;
    case "GET /api/v3/repos/acme/project/issues/1":
      sendJson(response, {
        number: 1,
        title: "Bug",
        body: "Broken",
        state: "open",
        html_url: `${enterpriseUrl}/issues/1`,
      });
      return;
    case "POST /api/v3/repos/acme/project/pulls":
      sendJson(response, {
        number: 2,
        title: "Fix",
        state: "open",
        html_url: `${enterpriseUrl}/pull/2`,
      });
      return;
    case "POST /api/v3/repos/acme/project/issues/1/comments":
      response.writeHead(204);
      response.end();
      return;
    default:
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "not found" }));
  }
}

function sendJson(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
