import { randomBytes } from "node:crypto";
import { z } from "zod";

export const RoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type Role = z.infer<typeof RoleSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: RoleSchema,
  content: z.string(),
  toolCallId: z.string().optional(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ProviderIdSchema = z.enum([
  "openrouter",
  "anthropic",
  "openai",
  "deepseek",
  "opencode",
]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: ProviderIdSchema,
  contextLength: z.number().int().positive(),
  capabilities: z.object({
    streaming: z.boolean(),
    functionCalling: z.boolean(),
    jsonMode: z.boolean(),
    vision: z.boolean(),
  }),
  pricing: z
    .object({
      inputPer1k: z.number().nonnegative(),
      outputPer1k: z.number().nonnegative(),
    })
    .optional(),
});
export type Model = z.infer<typeof ModelSchema>;

export const ChunkSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), content: z.string() }),
  z.object({ type: z.literal("tool_call"), call: ToolCallSchema }),
  z.object({ type: z.literal("reasoning"), content: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type Chunk = z.infer<typeof ChunkSchema>;

export const ChatOptionsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(z.record(z.unknown())).optional(),
  signal: z.instanceof(AbortSignal).optional(),
});
export type ChatOptions = z.infer<typeof ChatOptionsSchema>;

export const PermissionModeSchema = z.enum(["allow", "ask", "deny"]);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const OperationLevelSchema = z.enum(["read", "write", "git_local", "shell", "dangerous"]);
export type OperationLevel = z.infer<typeof OperationLevelSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const SessionStatusSchema = z.enum(["idle", "planning", "executing", "awaiting_approval", "error"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  worktree: z.string(),
  provider: ProviderIdSchema,
  model: z.string().optional(),
  status: SessionStatusSchema,
  messages: z.array(MessageSchema),
  activities: z.array(ActivitySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).default({}),
});
export type Session = z.infer<typeof SessionSchema>;

export const DeepCodeConfigSchema = z.object({
  defaultProvider: ProviderIdSchema.default("openrouter"),
  defaultModel: z.string().optional(),
  maxIterations: z.number().int().positive().default(20),
  providerRetries: z.number().int().min(0).max(5).default(2),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().default(4096),
  cache: z
    .object({
      enabled: z.boolean().default(true),
      ttlSeconds: z.number().int().positive().max(86400).default(300),
    })
    .default({}),
  providers: z
    .object({
      openrouter: z.object({ apiKey: z.string().optional(), baseUrl: z.string().url().optional() }).default({}),
      anthropic: z.object({ apiKey: z.string().optional(), baseUrl: z.string().url().optional() }).default({}),
      openai: z.object({ apiKey: z.string().optional(), baseUrl: z.string().url().optional() }).default({}),
      deepseek: z.object({ apiKey: z.string().optional(), baseUrl: z.string().url().optional() }).default({}),
      opencode: z.object({ apiKey: z.string().optional(), baseUrl: z.string().url().optional() }).default({}),
    })
    .default({}),
  permissions: z
    .object({
      read: PermissionModeSchema.default("allow"),
      write: PermissionModeSchema.default("ask"),
      gitLocal: PermissionModeSchema.default("allow"),
      shell: PermissionModeSchema.default("ask"),
      dangerous: PermissionModeSchema.default("ask"),
      allowShell: z.array(z.string()).default(["npm test", "npm run test", "npm run build", "pnpm test", "pnpm build", "git status"]),
    })
    .default({}),
  paths: z
    .object({
      whitelist: z.array(z.string()).default(["${WORKTREE}/**", "/tmp/deepcode/**"]),
      blacklist: z
        .array(z.string())
        .default(["**/.env", "**/.env.*", "**/.ssh/**", "**/.aws/**", "**/node_modules/**", "/etc/**", "/usr/bin/**", "${HOME}/.config/**"]),
    })
    .default({}),
  lsp: z
    .object({
      servers: z
        .array(
          z.object({
            languages: z.array(z.string().min(1)),
            command: z.string().min(1),
            args: z.array(z.string()).default([]),
            fileExtensions: z.array(z.string().min(1)).default([]),
          }),
        )
        .default([
          {
            languages: ["typescript", "javascript"],
            command: "typescript-language-server",
            args: ["--stdio"],
            fileExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
          },
          {
            languages: ["python"],
            command: "pylsp",
            args: [],
            fileExtensions: [".py"],
          },
          {
            languages: ["rust"],
            command: "rust-analyzer",
            args: [],
            fileExtensions: [".rs"],
          },
          {
            languages: ["go"],
            command: "gopls",
            args: [],
            fileExtensions: [".go"],
          },
        ]),
    })
    .default({}),
  github: z
    .object({
      token: z.string().optional(),
      enterpriseUrl: z.string().url().optional(),
    })
    .default({}),
});
export type DeepCodeConfig = z.infer<typeof DeepCodeConfigSchema>;

export const IssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  url: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const PullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  url: z.string(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix = "id"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}
