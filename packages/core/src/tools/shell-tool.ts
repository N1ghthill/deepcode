import { Effect } from "effect";
import { z } from "zod";
import { ToolExecutionError } from "../errors.js";
import { runShell } from "./process.js";
import { defineTool } from "./tool.js";

export type ShellRisk = "shell" | "dangerous" | "blocked";

export function classifyShellCommand(command: string): ShellRisk {
  const normalized = command.trim().replace(/\s+/g, " ");
  const blocked = [
    /\brm\s+-[^\n]*r[^\n]*f\b\s+(?:\/|\/\*|~|\$HOME)(?:\s|$)/,
    /\b(?:shutdown|reboot|poweroff|halt)\b/,
    /\bmkfs(?:\.[a-z0-9]+)?\b/,
    /\bdd\b.*\bof=\/dev\//,
    /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
    /\bchmod\s+-R\s+777\s+(?:\/|\/\*)/,
    /\bchown\s+-R\b.*\s+(?:\/|\/\*)/,
  ].some((pattern) => pattern.test(normalized));
  if (blocked) return "blocked";

  const dangerous = [
    /\brm\s+-[^\n]*r[^\n]*f\b/,
    /\bgit\s+push\b.*\s--force(?:-with-lease)?\b/,
    /\bgit\s+reset\s+--hard\b/,
    /\bdd\s+if=/,
    /\bsudo\b/,
    /\bcurl\b.*\|\s*(sh|bash)\b/,
    /\bwget\b.*\|\s*(sh|bash)\b/,
  ].some((pattern) => pattern.test(normalized));
  return dangerous ? "dangerous" : "shell";
}

export const bashTool = defineTool({
  name: "bash",
  description: "Execute a shell command in the project directory with timeout and permission checks.",
  parameters: z.object({
    command: z.string().min(1),
    cwd: z.string().default("."),
    timeout: z.number().int().positive().max(600).default(60),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const cwd = await context.pathSecurity.normalize(args.cwd);
        const risk = classifyShellCommand(args.command);
        if (risk === "blocked") {
          throw new Error(`Blocked unsafe shell command: ${args.command}`);
        }
        await context.permissions.ensure({
          operation: args.command.trim(),
          kind: risk,
          path: cwd,
          details: { command: args.command },
        });
        const result = await runShell(args.command, {
          cwd,
          timeoutMs: args.timeout * 1000,
          signal: context.abortSignal,
        });
        context.logActivity({
          type: "bash",
          message: `Ran ${args.command}`,
          metadata: { cwd, exitCode: result.exitCode },
        });
        const output = [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ""].filter(Boolean).join("\n");
        return output || `Command exited with ${result.exitCode ?? "unknown"} and no output`;
      },
      catch: (error) => new ToolExecutionError("Failed to execute shell command", error),
    }),
});
