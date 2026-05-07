import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { z } from "zod";
import { ToolExecutionError } from "../errors.js";
import { defineTool } from "./tool.js";

export const readFileTool = defineTool({
  name: "read_file",
  description: "Read a project file and return line-numbered content. Supports offset and limit.",
  parameters: z.object({
    path: z.string(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().positive().max(2000).optional(),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const filePath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "read_file", kind: "read", path: filePath });
        const content = await readFile(filePath, "utf8");
        const lines = content.split(/\r?\n/);
        const start = args.offset ?? 0;
        const end = args.limit ? Math.min(lines.length, start + args.limit) : lines.length;
        context.logActivity({
          type: "file_read",
          message: `Read ${path.relative(context.worktree, filePath)}`,
          metadata: { path: filePath, lines: end - start },
        });
        return lines
          .slice(start, end)
          .map((line, index) => `${String(start + index + 1).padStart(5, " ")} | ${line}`)
          .join("\n");
      },
      catch: (error) => new ToolExecutionError("Failed to read file", error),
    }),
});

export const writeFileTool = defineTool({
  name: "write_file",
  description: "Create or overwrite a file. Parent directories are created when needed.",
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const filePath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "write_file", kind: "write", path: filePath });
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, args.content, "utf8");
        context.logActivity({
          type: "file_written",
          message: `Wrote ${path.relative(context.worktree, filePath)}`,
          metadata: { path: filePath, bytes: Buffer.byteLength(args.content) },
        });
        return `File written: ${filePath}`;
      },
      catch: (error) => new ToolExecutionError("Failed to write file", error),
    }),
});

export const editFileTool = defineTool({
  name: "edit_file",
  description: "Replace exactly one occurrence of oldString in a file.",
  parameters: z.object({
    path: z.string(),
    oldString: z.string().min(1),
    newString: z.string(),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const filePath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "edit_file", kind: "write", path: filePath });
        const content = await readFile(filePath, "utf8");
        const occurrences = content.split(args.oldString).length - 1;
        if (occurrences === 0) {
          throw new Error("oldString was not found in the target file");
        }
        if (occurrences > 1) {
          throw new Error(`oldString matched ${occurrences} times; provide a more specific string`);
        }
        const next = content.replace(args.oldString, args.newString);
        await writeFile(filePath, next, "utf8");
        context.logActivity({
          type: "file_edited",
          message: `Edited ${path.relative(context.worktree, filePath)}`,
          metadata: { path: filePath, removedBytes: args.oldString.length, addedBytes: args.newString.length },
        });
        return `File edited: ${filePath}`;
      },
      catch: (error) => new ToolExecutionError("Failed to edit file", error),
    }),
});

export const listDirTool = defineTool({
  name: "list_dir",
  description: "List directory entries with type, size, and relative path.",
  parameters: z.object({
    path: z.string().default("."),
  }),
  execute: (args, context) =>
    Effect.tryPromise({
      try: async () => {
        const dirPath = await context.pathSecurity.normalize(args.path);
        await context.permissions.ensure({ operation: "list_dir", kind: "read", path: dirPath });
        const entries = await readdir(dirPath, { withFileTypes: true });
        const rows = await Promise.all(
          entries
            .filter((entry) => entry.name !== "node_modules" && entry.name !== ".git")
            .map(async (entry) => {
              const fullPath = path.join(dirPath, entry.name);
              const info = await stat(fullPath);
              const type = entry.isDirectory() ? "dir " : "file";
              return `${type} ${String(info.size).padStart(9, " ")} ${entry.name}`;
            }),
        );
        context.logActivity({
          type: "directory_listed",
          message: `Listed ${path.relative(context.worktree, dirPath) || "."}`,
          metadata: { path: dirPath, entries: rows.length },
        });
        return rows.join("\n");
      },
      catch: (error) => new ToolExecutionError("Failed to list directory", error),
    }),
});
