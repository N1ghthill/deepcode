import { render } from "ink";
import React from "react";
import { Command } from "commander";
import { cacheClearCommand } from "./commands/cache.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { createPrCommand, listIssuesCommand, solveIssueCommand } from "./commands/github.js";
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
    .option("-y, --yes", "approve permission requests for this run")
    .action(async (prompt: string[], options: { yes?: boolean }) => {
      await runCommand(prompt.join(" "), {
        cwd: program.opts().cwd,
        config: program.opts().config,
        yes: options.yes,
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

  const github = program.command("github").description("GitHub operations");
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
  await createProgram().parseAsync(argv);
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
