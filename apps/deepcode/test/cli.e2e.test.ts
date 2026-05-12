import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(appRoot, "dist", "index.js");
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("deepcode CLI e2e", () => {
  it("initializes config in a clean worktree", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    const result = await runCli(["--cwd", tempDir, "init"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(".deepcode/config.json");
    const config = JSON.parse(
      await readFile(path.join(tempDir, ".deepcode", "config.json"), "utf8"),
    ) as unknown;
    expect(config).toBeTruthy();
  });

  it("prints doctor failures without credentials", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    const result = await runCli(["--cwd", tempDir, "doctor"], {
      GITHUB_TOKEN: "",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("ok smoke:tools:");
    expect(result.stdout).toContain("provider");
    expect(result.stdout).toContain("model");
  });

  it("exposes subagents and cache commands", async () => {
    const subagents = await runCli(["subagents", "--help"]);
    expect(subagents.exitCode).toBe(0);
    expect(subagents.stdout).toContain("run real child agent sessions");

    const cache = await runCli(["cache", "--help"]);
    expect(cache.exitCode).toBe(0);
    expect(cache.stdout).toContain("manage persistent tool cache");

    const config = await runCli(["config", "--help"]);
    expect(config.exitCode).toBe(0);
    expect(config.stdout).toContain("view and edit .deepcode/config.json");

    const github = await runCli(["github", "login", "--help"]);
    expect(github.exitCode).toBe(0);
    expect(github.stdout).toContain("OAuth device flow");

    const whoami = await runCli(["github", "whoami", "--help"]);
    expect(whoami.exitCode).toBe(0);
    expect(whoami.stdout).toContain("real GitHub API");
  });

  it("edits config values and masks secrets", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));

    const setModel = await runCli([
      "--cwd",
      tempDir,
      "config",
      "set",
      "defaultModel",
      "openai/test-model",
    ]);
    expect(setModel.exitCode).toBe(0);
    const getModel = await runCli(["--cwd", tempDir, "config", "get", "defaultModel"]);
    expect(getModel.exitCode).toBe(0);
    expect(getModel.stdout.trim()).toBe("openai/test-model");

    const setKey = await runCli([
      "--cwd",
      tempDir,
      "config",
      "set",
      "providers.openrouter.apiKey",
      "secret-value",
    ]);
    expect(setKey.exitCode).toBe(0);
    const getKey = await runCli(["--cwd", tempDir, "config", "get", "providers.openrouter.apiKey"]);
    expect(getKey.exitCode).toBe(0);
    expect(getKey.stdout).toContain("[set]");
    expect(getKey.stdout).not.toContain("secret-value");
  });

  it("shows effective config from environment without writing secrets", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    const show = await runCli(["--cwd", tempDir, "config", "show", "--effective"], {
      DEEPCODE_MODEL: "env/model",
      OPENROUTER_API_KEY: "env-secret",
    });
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("env/model");
    expect(show.stdout).toContain("[set]");
    expect(show.stdout).not.toContain("env-secret");
  });

  it("works from a TypeScript project fixture inside a git repository", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    await createTypeScriptFixture(tempDir);

    const configPath = await runCli(["--cwd", tempDir, "config", "path"]);
    expect(configPath.exitCode).toBe(0);
    expect(configPath.stdout.trim()).toBe(path.join(tempDir, ".deepcode", "config.json"));

    const setShellAllowlist = await runCli([
      "--cwd",
      tempDir,
      "config",
      "set",
      "permissions.allowShell",
      '["pnpm test","pnpm build","git status"]',
    ]);
    expect(setShellAllowlist.exitCode).toBe(0);

    const showConfig = await runCli(["--cwd", tempDir, "config", "show"]);
    expect(showConfig.exitCode).toBe(0);
    expect(showConfig.stdout).toContain("pnpm test");

    const doctor = await runCli(["--cwd", tempDir, "doctor"]);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("ok git:");
    expect(doctor.stdout).toContain("ok smoke:tools:");
    expect(doctor.stdout).toContain("provider");
    expect(doctor.stderr).toBe("");
  });

  it("works from a Python project fixture inside a git repository", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    await createPythonFixture(tempDir);

    const configPath = await runCli(["--cwd", tempDir, "config", "path"]);
    expect(configPath.exitCode).toBe(0);
    expect(configPath.stdout.trim()).toBe(path.join(tempDir, ".deepcode", "config.json"));

    const init = await runCli(["--cwd", tempDir, "init"]);
    expect(init.exitCode).toBe(0);

    const showConfig = await runCli(["--cwd", tempDir, "config", "show"]);
    expect(showConfig.exitCode).toBe(0);
    expect(showConfig.stdout).toContain("openrouter");

    const setProvider = await runCli([
      "--cwd",
      tempDir,
      "config",
      "set",
      "defaultProvider",
      "anthropic",
    ]);
    expect(setProvider.exitCode).toBe(0);

    const getProvider = await runCli(["--cwd", tempDir, "config", "get", "defaultProvider"]);
    expect(getProvider.exitCode).toBe(0);
    expect(getProvider.stdout.trim()).toBe("anthropic");

    const doctor = await runCli(["--cwd", tempDir, "doctor"]);
    expect(doctor.exitCode).toBe(1);
    expect(doctor.stdout).toContain("ok git:");
    expect(doctor.stdout).toContain("ok smoke:tools:");
    expect(doctor.stdout).toContain("provider");
    expect(doctor.stderr).toBe("");
  }, 10_000);

  it("runs GitHub CLI commands against a configured local enterprise API", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-cli-"));
    await createTypeScriptFixture(tempDir);
    const server = await startGitHubTestServer();

    try {
      const setToken = await runCli([
        "--cwd",
        tempDir,
        "config",
        "set",
        "github.token",
        "e2e-token",
      ]);
      expect(setToken.exitCode).toBe(0);
      const setEnterpriseUrl = await runCli([
        "--cwd",
        tempDir,
        "config",
        "set",
        "github.enterpriseUrl",
        server.url,
      ]);
      expect(setEnterpriseUrl.exitCode).toBe(0);

      const whoami = await runCli(["--cwd", tempDir, "github", "whoami"]);
      expect(whoami.exitCode).toBe(0);
      expect(whoami.stdout).toContain("octocat (1)");
      expect(whoami.stdout).toContain(`${server.url}/octocat`);
      expect(whoami.stdout).not.toContain("e2e-token");

      const doctor = await runCli(["--cwd", tempDir, "doctor"]);
      expect(doctor.exitCode).toBe(1);
      expect(doctor.stdout).toContain("ok smoke:tools:");
      expect(doctor.stdout).toContain("ok github: authenticated as octocat");
      expect(doctor.stdout).toContain("provider");
      expect(doctor.stdout).not.toContain("e2e-token");

      const issues = await runCli(["--cwd", tempDir, "github", "issues", "--state", "all"]);
      expect(issues.exitCode).toBe(0);
      expect(issues.stdout).toContain("#7 open E2E issue");
      expect(issues.stdout).toContain(`${server.url}/issues/7`);
      expect(issues.stdout).not.toContain("Existing PR");

      const pr = await runCli([
        "--cwd",
        tempDir,
        "github",
        "pr",
        "--title",
        "E2E PR",
        "--body",
        "Created by CLI e2e",
        "--head",
        "feature/e2e",
        "--base",
        "main",
      ]);
      expect(pr.exitCode).toBe(0);
      expect(pr.stdout).toContain("#9 E2E PR");
      expect(pr.stdout).toContain(`${server.url}/pull/9`);

      expect(server.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
        "GET /api/v3/user",
        "GET /api/v3/user",
        "GET /api/v3/repos/acme/fixture/issues?state=all",
        "POST /api/v3/repos/acme/fixture/pulls",
      ]);
      expect(server.requests[3]?.body).toEqual({
        title: "E2E PR",
        body: "Created by CLI e2e",
        head: "feature/e2e",
        base: "main",
      });
      expect(server.requests.every((request) => request.authorization === "Bearer e2e-token")).toBe(
        true,
      );
    } finally {
      await server.close();
    }
  }, 15_000);
});

function runCli(
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const cleanEnv = {
    DEEPCODE_PROVIDER: "",
    DEEPCODE_MODEL: "",
    OPENROUTER_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    OPENAI_API_KEY: "",
    DEEPSEEK_API_KEY: "",
    OPENCODE_API_KEY: "",
    GITHUB_TOKEN: "",
    GITHUB_OAUTH_CLIENT_ID: "",
    GITHUB_OAUTH_SCOPES: "",
  };
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [bin, ...args],
      { cwd: appRoot, env: { ...process.env, ...cleanEnv, ...env }, timeout: 30_000 },
      (error, stdout, stderr) => {
        const maybeExit = error as (NodeJS.ErrnoException & { code?: number | null }) | null;
        if (error && typeof maybeExit?.code !== "number") {
          reject(error);
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: typeof maybeExit?.code === "number" ? maybeExit.code : 0,
        });
      },
    );
  });
}

async function createTypeScriptFixture(root: string): Promise<void> {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        type: "module",
        scripts: {
          build: "tsc --noEmit",
          test: "tsc --noEmit",
        },
        devDependencies: {
          typescript: "^5.7.2",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "index.ts"),
    "export function add(left: number, right: number): number {\n  return left + right;\n}\n",
    "utf8",
  );
  await runCommand("git", ["init"], root);
  await runCommand("git", ["remote", "add", "origin", "https://github.com/acme/fixture.git"], root);
}

async function createPythonFixture(root: string): Promise<void> {
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "pyproject.toml"),
    `[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "fixture"
version = "0.1.0"
requires-python = ">=3.10"

[tool.pytest.ini_options]
testpaths = ["tests"]
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "__init__.py"),
    "",
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "calculator.py"),
    `def add(left: float, right: float) -> float:
    return left + right


def subtract(left: float, right: float) -> float:
    return left - right
`,
    "utf8",
  );
  await mkdir(path.join(root, "tests"), { recursive: true });
  await writeFile(
    path.join(root, "tests", "__init__.py"),
    "",
    "utf8",
  );
  await writeFile(
    path.join(root, "tests", "test_calculator.py"),
    `from src.calculator import add, subtract


def test_add():
    assert add(2, 3) == 5


def test_subtract():
    assert subtract(5, 3) == 2
`,
    "utf8",
  );
  await runCommand("git", ["init"], root);
  await runCommand("git", ["remote", "add", "origin", "https://github.com/acme/python-fixture.git"], root);
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, timeout: 30_000 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

interface GitHubTestServer {
  url: string;
  requests: Array<{ method: string; url: string; authorization: string; body: unknown }>;
  close: () => Promise<void>;
}

async function startGitHubTestServer(): Promise<GitHubTestServer> {
  const requests: GitHubTestServer["requests"] = [];
  const server = createServer(async (request, response) => {
    requests.push({
      method: request.method ?? "GET",
      url: request.url ?? "",
      authorization: request.headers.authorization ?? "",
      body: await readJsonBody(request),
    });
    handleGitHubApi(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to bind local GitHub test server");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function handleGitHubApi(request: IncomingMessage, response: ServerResponse): void {
  const baseUrl = `http://${request.headers.host}`;
  switch (`${request.method ?? "GET"} ${request.url ?? ""}`) {
    case "GET /api/v3/user":
      sendJson(response, { login: "octocat", id: 1, html_url: `${baseUrl}/octocat` });
      return;
    case "GET /api/v3/repos/acme/fixture/issues?state=all":
      sendJson(response, [
        {
          number: 7,
          title: "E2E issue",
          body: "Exercise GitHub CLI",
          state: "open",
          html_url: `${baseUrl}/issues/7`,
        },
        {
          number: 8,
          title: "Existing PR",
          body: null,
          state: "open",
          html_url: `${baseUrl}/pull/8`,
          pull_request: {},
        },
      ]);
      return;
    case "POST /api/v3/repos/acme/fixture/pulls":
      sendJson(response, {
        number: 9,
        title: "E2E PR",
        state: "open",
        html_url: `${baseUrl}/pull/9`,
      });
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
