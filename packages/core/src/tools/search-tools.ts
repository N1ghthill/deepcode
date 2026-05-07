import path from "node:path";
import { Effect } from "effect";
import { z } from "zod";
import { ToolExecutionError } from "../errors.js";
import { readJsonLines } from "../utils/json.js";
import { execFileAsync } from "./process.js";
import { defineTool } from "./tool.js";

export const searchTextTool = defineTool({
  name: "search_text",
  description: "Search text or regex patterns using ripgrep. Returns JSON match rows.",
  parameters: z.object({
    pattern: z.string().min(1),
    path: z.string().default("."),
    include: z.string().optional(),
    context: z.number().int().min(0).max(10).default(2),
    caseSensitive: z.boolean().default(true),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const searchPath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "search_text", kind: "read", path: searchPath });
        const rgArgs = ["--json", "--context", String(args.context)];
        if (!args.caseSensitive) rgArgs.push("--ignore-case");
        if (args.include) rgArgs.push("--glob", args.include);
        rgArgs.push(args.pattern, searchPath);
        const result = await execFileAsync("rg", rgArgs, {
          cwd: context.worktree,
          timeoutMs: 30_000,
          signal: context.abortSignal,
        });
        if (result.exitCode !== 0 && result.exitCode !== 1) {
          throw new Error(result.stderr || `ripgrep exited with ${result.exitCode}`);
        }
        const matches = readJsonLines(result.stdout)
          .filter((row: any) => row.type === "match")
          .map((row: any) => ({
            file: row.data.path.text,
            line: row.data.line_number,
            text: row.data.lines.text.trimEnd(),
            matches: row.data.submatches?.map((match: any) => ({
              text: match.match.text,
              start: match.start,
              end: match.end,
            })),
          }));
        context.logActivity({
          type: "text_search",
          message: `Searched ${path.relative(context.worktree, searchPath) || "."}`,
          metadata: { pattern: args.pattern, matches: matches.length },
        });
        return JSON.stringify(matches, null, 2);
      },
      catch: (error) => new ToolExecutionError("Failed to search text", error),
    }),
});

export const searchFilesTool = defineTool({
  name: "search_files",
  description: "Find files by name using ripgrep file listing.",
  parameters: z.object({
    query: z.string().min(1),
    path: z.string().default("."),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const searchPath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "search_files", kind: "read", path: searchPath });
        const result = await execFileAsync("rg", ["--files", searchPath], {
          cwd: context.worktree,
          timeoutMs: 30_000,
          signal: context.abortSignal,
        });
        if (result.exitCode !== 0 && result.exitCode !== 1) {
          throw new Error(result.stderr || `ripgrep exited with ${result.exitCode}`);
        }
        const needle = args.query.toLowerCase();
        const files = result.stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .filter((file) => path.basename(file).toLowerCase().includes(needle))
          .slice(0, 200);
        context.logActivity({
          type: "file_search",
          message: `Found ${files.length} file(s)`,
          metadata: { query: args.query },
        });
        return files.join("\n");
      },
      catch: (error) => new ToolExecutionError("Failed to search files", error),
    }),
});

export const searchSymbolsTool = defineTool({
  name: "search_symbols",
  description: "Search symbol-like declarations in source files using ripgrep patterns.",
  parameters: z.object({
    query: z.string().min(1),
    path: z.string().default("."),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const searchPath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "search_symbols", kind: "read", path: searchPath });
        const pattern = `(class|interface|type|function|const|let|var|def|func)\\s+${args.query}`;
        const result = await execFileAsync("rg", ["--json", "--glob", "!node_modules", pattern, searchPath], {
          cwd: context.worktree,
          timeoutMs: 30_000,
          signal: context.abortSignal,
        });
        if (result.exitCode !== 0 && result.exitCode !== 1) {
          throw new Error(result.stderr || `ripgrep exited with ${result.exitCode}`);
        }
        const symbols = readJsonLines(result.stdout)
          .filter((row: any) => row.type === "match")
          .map((row: any) => ({
            file: row.data.path.text,
            line: row.data.line_number,
            declaration: row.data.lines.text.trim(),
          }))
          .slice(0, 100);
        return JSON.stringify(symbols, null, 2);
      },
      catch: (error) => new ToolExecutionError("Failed to search symbols", error),
    }),
});
