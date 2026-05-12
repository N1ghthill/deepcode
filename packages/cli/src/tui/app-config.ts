import type { ProviderId, Session } from "@deepcode/shared";
import { themeNames } from "./themes.js";
import type { ModalType } from "./types.js";

export type ConfigEditField =
  | "defaultProvider"
  | `defaultModels.${ProviderId}`
  | "buildTurnPolicy.mode"
  | "providers.openrouter.apiKey"
  | "providers.anthropic.apiKey"
  | "providers.openai.apiKey"
  | "providers.deepseek.apiKey"
  | "providers.opencode.apiKey"
  | "cache.enabled"
  | "cache.ttlSeconds"
  | "permissions.read"
  | "permissions.write"
  | "permissions.shell"
  | "permissions.dangerous"
  | "permissions.gitLocal"
  | "permissions.allowShell"
  | "paths.whitelist"
  | "paths.blacklist"
  | "web.allowlist"
  | "web.blacklist"
  | "github.oauthClientId"
  | "tui.theme"
  | "tui.compactMode"
  | "tui.showInputPreview";

export interface ConfigFieldDef {
  key: ConfigEditField;
  label: string;
  type: "select" | "number" | "toggle" | "text";
  options?: string[];
}

export interface GithubOAuthState {
  status: "idle" | "opening" | "waiting" | "saving" | "success" | "error" | "cancelled";
  verificationUri?: string;
  userCode?: string;
  expiresAt?: string;
  message?: string;
  browserError?: string;
}

export interface SlashCommandDef {
  command: string;
  label: string;
  description: string;
}

export interface SlashMenuKeyState {
  upArrow?: boolean;
  downArrow?: boolean;
  tab?: boolean;
  escape?: boolean;
  return?: boolean;
}

export type SlashMenuAction =
  | { type: "move"; selectedIndex: number }
  | { type: "close" }
  | { type: "execute"; command: string };

export interface ChatPreflightIssue {
  message: string;
  notice: string;
  modal?: ModalType;
}

export type InitialSessionSelection =
  | { type: "reuse"; session: Session }
  | { type: "create"; provider: ProviderId; model?: string };

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { command: "/github-login", label: "GitHub login", description: "Abre o navegador e autentica GitHub via OAuth" },
  { command: "/provider", label: "Providers", description: "Configura e testa provider/model/API" },
  { command: "/model", label: "Modelos", description: "Seleciona o modelo ativo" },
  { command: "/mode plan", label: "Modo PLAN", description: "Analisa e planeja sem alterar arquivos" },
  { command: "/mode build", label: "Modo BUILD", description: "Permite editar e validar com permissões" },
  { command: "/config", label: "Config", description: "Abre editor de configuração" },
  { command: "/sessions", label: "Sessões", description: "Lista sessões salvas" },
  { command: "/new", label: "Nova sessão", description: "Cria uma sessão nova" },
  { command: "/clear", label: "Limpar chat", description: "Limpa a tela sem apagar a sessão" },
  { command: "/help", label: "Ajuda", description: "Mostra atalhos e comandos" },
];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  openai: "OpenAI",
  deepseek: "DeepSeek",
  opencode: "OpenCode",
};

export const PROVIDER_IDS = Object.keys(PROVIDER_LABELS) as ProviderId[];

export const CONFIG_FIELDS: ConfigFieldDef[] = [
  { key: "defaultProvider", label: "Provider", type: "select", options: ["openrouter", "anthropic", "openai", "deepseek", "opencode"] },
  { key: "defaultModels.openrouter", label: "OpenRouter model", type: "text" },
  { key: "defaultModels.anthropic", label: "Anthropic model", type: "text" },
  { key: "defaultModels.openai", label: "OpenAI model", type: "text" },
  { key: "defaultModels.deepseek", label: "DeepSeek model", type: "text" },
  { key: "defaultModels.opencode", label: "OpenCode model", type: "text" },
  { key: "buildTurnPolicy.mode", label: "Build turn policy", type: "select", options: ["heuristic", "always-tools"] },
  { key: "providers.openrouter.apiKey", label: "OpenRouter API Key", type: "text" },
  { key: "providers.anthropic.apiKey", label: "Anthropic API Key", type: "text" },
  { key: "providers.openai.apiKey", label: "OpenAI API Key", type: "text" },
  { key: "providers.deepseek.apiKey", label: "DeepSeek API Key", type: "text" },
  { key: "providers.opencode.apiKey", label: "OpenCode API Key", type: "text" },
  { key: "cache.enabled", label: "Cache", type: "toggle" },
  { key: "cache.ttlSeconds", label: "Cache TTL (s)", type: "number" },
  { key: "permissions.read", label: "Read perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.write", label: "Write perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.shell", label: "Shell perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.dangerous", label: "Dangerous perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.gitLocal", label: "Git local perm", type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.allowShell", label: "Shell allowlist (JSON)", type: "text" },
  { key: "paths.whitelist", label: "Paths whitelist (JSON)", type: "text" },
  { key: "paths.blacklist", label: "Paths blacklist (JSON)", type: "text" },
  { key: "web.allowlist", label: "Web allowlist (JSON)", type: "text" },
  { key: "web.blacklist", label: "Web blacklist (JSON)", type: "text" },
  { key: "github.oauthClientId", label: "GitHub OAuth Client ID", type: "text" },
  { key: "tui.theme", label: "Theme", type: "select", options: themeNames },
  { key: "tui.compactMode", label: "Compact mode", type: "toggle" },
  { key: "tui.showInputPreview", label: "Show input preview", type: "toggle" },
];
