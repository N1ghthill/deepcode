import { render } from "ink";
import React from "react";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { createPrCommand, listIssuesCommand } from "./commands/github.js";
import { runCommand } from "./commands/run.js";
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
