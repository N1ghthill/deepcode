import { render } from "ink";
import React from "react";
import { Command } from "commander";
import { redactText } from "@deepcode/core";
import type { AgentMode } from "@deepcode/shared";
import { cacheClearCommand } from "./commands/cache.js";
import {
  configGetCommand,
  configPathCommand,
  configSetCommand,
  configShowCommand,
  configUnsetCommand,
} from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import {
  createPrCommand,
  githubLoginCommand,
  githubWhoamiCommand,
  listIssuesCommand,
  solveIssueCommand,
} from "./commands/github.js";
import { runCommand } from "./commands/run.js";
import { subagentsRunCommand } from "./commands/subagents.js";
import { App } from "./tui/App.js";

export function createProgram(): Command {
  const program = new Command();
  program
    .name("deepcode")
    .description("AI coding agent for the terminal")
    .version("1.0.0")
    .option("-C, --cwd <path>", "working directory", process.cwd())
    .option("--config <path>", "config file path");

  program
    .command("init")
    .description("create .deepcode/config.json")
    .action(async () => {
      await initCommand(program.opts().cwd);
    });

  program
    .command("run")
    .description("run one non-interactive task")
    .argument("<prompt...>", "task prompt")
    .option("--mode <mode>", "agent mode: plan or build")
    .option("-y, --yes", "approve permission requests for this run")
    .action(async (prompt: string[], options: { yes?: boolean; mode?: AgentMode }) => {
      await runCommand(prompt.join(" "), {
        cwd: program.opts().cwd,
        config: program.opts().config,
        yes: options.yes,
        mode: options.mode,
      });
    });

  program
    .command("doctor")
    .description("validate local tools, provider config, GitHub token, and LSP servers")
    .action(async () => {
      await doctorCommand({ cwd: program.opts().cwd, config: program.opts().config });
    });

  const cache = program.command("cache").description("manage persistent tool cache");
  cache
    .command("clear")
    .description("clear .deepcode/cache")
    .action(async () => {
      await cacheClearCommand({ cwd: program.opts().cwd, config: program.opts().config });
    });

  const config = program.command("config").description("view and edit .deepcode/config.json");
  config
    .command("path")
    .description("print the active config file path")
    .action(async () => {
      await configPathCommand({ cwd: program.opts().cwd, config: program.opts().config });
    });
  config
    .command("show")
    .description("print config as JSON with secrets masked")
    .option("--effective", "include environment variable overrides")
    .action(async (options: { effective?: boolean }) => {
      await configShowCommand({
        cwd: program.opts().cwd,
        config: program.opts().config,
        effective: options.effective,
      });
    });
  config
    .command("get")
    .description("print one config value with secrets masked")
    .argument("<key>", "dot-separated config key")
    .option("--effective", "include environment variable overrides")
    .action(async (key: string, options: { effective?: boolean }) => {
      await configGetCommand(key, {
        cwd: program.opts().cwd,
        config: program.opts().config,
        effective: options.effective,
      });
    });
  config
    .command("set")
    .description("set one config value")
    .argument("<key>", "dot-separated config key")
    .argument("<value>", "new value; arrays and objects must be JSON")
    .option("--json", "parse value as JSON")
    .action(async (key: string, value: string, options: { json?: boolean }) => {
      await configSetCommand(key, value, {
        cwd: program.opts().cwd,
        config: program.opts().config,
        json: options.json,
      });
    });
  config
    .command("unset")
    .description("remove one config value and fall back to schema defaults when applicable")
    .argument("<key>", "dot-separated config key")
    .action(async (key: string) => {
      await configUnsetCommand(key, { cwd: program.opts().cwd, config: program.opts().config });
    });

  const github = program.command("github").description("GitHub operations");
  github
    .command("login")
    .description("authorize GitHub with the real OAuth device flow")
    .option("--client-id <id>", "GitHub OAuth app client ID")
    .option("--no-browser", "print the verification URL without opening a browser")
    .option(
      "--scope <scope>",
      "OAuth scope to request; repeat for multiple scopes",
      collectOption,
      [],
    )
    .action(async (options: { clientId?: string; scope: string[]; browser?: boolean }) => {
      await githubLoginCommand({
        cwd: program.opts().cwd,
        config: program.opts().config,
        clientId: options.clientId,
        scopes: options.scope,
        openBrowser: options.browser !== false,
      });
    });
  github
    .command("whoami")
    .description("validate the configured GitHub token against the real GitHub API")
    .action(async () => {
      await githubWhoamiCommand({
        cwd: program.opts().cwd,
        config: program.opts().config,
      });
    });
  github
    .command("issues")
    .description("list repository issues")
    .option("--state <state>", "open, closed, or all", "open")
    .action(async (options: { state: "open" | "closed" | "all" }) => {
      await listIssuesCommand({
        cwd: program.opts().cwd,
        config: program.opts().config,
        state: options.state,
      });
    });

  const subagents = program.command("subagents").description("run real child agent sessions");
  subagents
    .command("run")
    .description("run multiple tasks in parallel subagent sessions")
    .requiredOption("--task <prompt>", "task prompt; repeat for multiple tasks", collectOption, [])
    .option("--concurrency <number>", "parallelism", parsePositiveInt)
    .option("-y, --yes", "approve permission requests for this run")
    .action(async (options: { task: string[]; concurrency?: number; yes?: boolean }) => {
      await subagentsRunCommand({
        cwd: program.opts().cwd,
        config: program.opts().config,
        tasks: options.task,
        concurrency: options.concurrency,
        yes: options.yes,
      });
    });
  github
    .command("pr")
    .description("create a pull request")
    .requiredOption("--title <title>", "PR title")
    .requiredOption("--body <body>", "PR body")
    .requiredOption("--head <head>", "head branch")
    .option("--base <base>", "base branch", "main")
    .action(async (options: { title: string; body: string; head: string; base: string }) => {
      await createPrCommand(options, { cwd: program.opts().cwd, config: program.opts().config });
    });
  github
    .command("solve")
    .description("solve a GitHub issue end-to-end with branch, commit, push, and PR")
    .argument("<number>", "issue number")
    .option("--base <base>", "base branch", "main")
    .option("-y, --yes", "approve commit/push/PR workflow")
    .action(async (number: string, options: { base?: string; yes?: boolean }) => {
      const issueNumber = Number.parseInt(number, 10);
      if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
        throw new Error(`Invalid issue number: ${number}`);
      }
      await solveIssueCommand(issueNumber, {
        cwd: program.opts().cwd,
        config: program.opts().config,
        base: options.base,
        yes: options.yes,
      });
    });

  program
    .command("chat", { isDefault: true })
    .description("open the terminal UI")
    .action(() => {
      render(React.createElement(App, { cwd: program.opts().cwd, config: program.opts().config }));
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  try {
    await createProgram().parseAsync(argv);
  } catch (error) {
    console.error(redactText(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}

function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${value}`);
  }
  return parsed;
}
