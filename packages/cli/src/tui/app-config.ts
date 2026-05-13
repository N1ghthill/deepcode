import type { ProviderId, Session } from "@deepcode/shared";
import { themeNames } from "./themes.js";
import type { ModalType } from "./types.js";
import { t } from "./i18n/index.js";

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
  | "agentPermissions.build.shell"
  | "agentPermissions.build.dangerous"
  | "agentPermissions.build.write"
  | "agentPermissions.build.read"
  | "agentPermissions.build.gitLocal"
  | "agentPermissions.plan.shell"
  | "agentPermissions.plan.dangerous"
  | "agentPermissions.plan.write"
  | "agentPermissions.plan.read"
  | "agentPermissions.plan.gitLocal"
  | "paths.whitelist"
  | "paths.blacklist"
  | "web.allowlist"
  | "web.blacklist"
  | "github.oauthClientId"
  | "tui.theme"
  | "tui.compactMode"
  | "tui.showInputPreview"
  | "tui.language";

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
  | { type: "execute"; command: string }
  | { type: "complete"; command: string };

export interface ChatPreflightIssue {
  message: string;
  notice: string;
  modal?: ModalType;
}

export type InitialSessionSelection =
  | { type: "reuse"; session: Session }
  | { type: "create"; provider: ProviderId; model?: string };

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { command: "/github-login", get label() { return t("slashGithubLoginLabel"); }, get description() { return t("slashGithubLoginDesc"); } },
  { command: "/provider", get label() { return t("slashProviderLabel"); }, get description() { return t("slashProviderDesc"); } },
  { command: "/model", get label() { return t("slashModelLabel"); }, get description() { return t("slashModelDesc"); } },
  { command: "/mode plan", get label() { return t("slashModePlanLabel"); }, get description() { return t("slashModePlanDesc"); } },
  { command: "/mode build", get label() { return t("slashModeBuildLabel"); }, get description() { return t("slashModeBuildDesc"); } },
  { command: "/config", get label() { return t("slashConfigLabel"); }, get description() { return t("slashConfigDesc"); } },
  { command: "/sessions", get label() { return t("slashSessionsLabel"); }, get description() { return t("slashSessionsDesc"); } },
  { command: "/new", get label() { return t("slashNewLabel"); }, get description() { return t("slashNewDesc"); } },
  { command: "/clear", get label() { return t("slashClearLabel"); }, get description() { return t("slashClearDesc"); } },
  { command: "/help", get label() { return t("slashHelpLabel"); }, get description() { return t("slashHelpDesc"); } },
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
  { key: "defaultProvider", get label() { return t("configFieldDefaultProvider"); }, type: "select", options: ["openrouter", "anthropic", "openai", "deepseek", "opencode"] },
  { key: "defaultModels.openrouter", get label() { return t("configFieldOpenRouterModel"); }, type: "text" },
  { key: "defaultModels.anthropic", get label() { return t("configFieldAnthropicModel"); }, type: "text" },
  { key: "defaultModels.openai", get label() { return t("configFieldOpenAIModel"); }, type: "text" },
  { key: "defaultModels.deepseek", get label() { return t("configFieldDeepSeekModel"); }, type: "text" },
  { key: "defaultModels.opencode", get label() { return t("configFieldOpenCodeModel"); }, type: "text" },
  { key: "buildTurnPolicy.mode", get label() { return t("configFieldBuildTurnPolicy"); }, type: "select", options: ["heuristic", "always-tools"] },
  { key: "providers.openrouter.apiKey", get label() { return t("configFieldOpenRouterApiKey"); }, type: "text" },
  { key: "providers.anthropic.apiKey", get label() { return t("configFieldAnthropicApiKey"); }, type: "text" },
  { key: "providers.openai.apiKey", get label() { return t("configFieldOpenAIApiKey"); }, type: "text" },
  { key: "providers.deepseek.apiKey", get label() { return t("configFieldDeepSeekApiKey"); }, type: "text" },
  { key: "providers.opencode.apiKey", get label() { return t("configFieldOpenCodeApiKey"); }, type: "text" },
  { key: "cache.enabled", get label() { return t("configFieldCache"); }, type: "toggle" },
  { key: "cache.ttlSeconds", get label() { return t("configFieldCacheTtl"); }, type: "number" },
  { key: "permissions.read", get label() { return t("configFieldReadPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.write", get label() { return t("configFieldWritePerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.shell", get label() { return t("configFieldShellPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.dangerous", get label() { return t("configFieldDangerousPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.gitLocal", get label() { return t("configFieldGitLocalPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "permissions.allowShell", get label() { return t("configFieldShellAllowlist"); }, type: "text" },
  { key: "agentPermissions.build.shell", get label() { return t("configFieldBuildShellPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "agentPermissions.build.dangerous", get label() { return t("configFieldBuildDangerousPerm"); }, type: "select", options: ["ask", "allow", "deny"] },
  { key: "agentPermissions.build.write", get label() { return t("configFieldBuildWritePerm"); }, type: "select", options: ["ask", "allow", "deny"] },
  { key: "agentPermissions.build.read", get label() { return t("configFieldBuildReadPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "agentPermissions.build.gitLocal", get label() { return t("configFieldBuildGitLocalPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "agentPermissions.plan.shell", get label() { return t("configFieldPlanShellPerm"); }, type: "select", options: ["ask", "deny", "allow"] },
  { key: "agentPermissions.plan.dangerous", get label() { return t("configFieldPlanDangerousPerm"); }, type: "select", options: ["deny", "ask", "allow"] },
  { key: "agentPermissions.plan.write", get label() { return t("configFieldPlanWritePerm"); }, type: "select", options: ["deny", "ask", "allow"] },
  { key: "agentPermissions.plan.read", get label() { return t("configFieldPlanReadPerm"); }, type: "select", options: ["allow", "ask", "deny"] },
  { key: "agentPermissions.plan.gitLocal", get label() { return t("configFieldPlanGitLocalPerm"); }, type: "select", options: ["ask", "allow", "deny"] },
  { key: "paths.whitelist", get label() { return t("configFieldPathsWhitelist"); }, type: "text" },
  { key: "paths.blacklist", get label() { return t("configFieldPathsBlacklist"); }, type: "text" },
  { key: "web.allowlist", get label() { return t("configFieldWebAllowlist"); }, type: "text" },
  { key: "web.blacklist", get label() { return t("configFieldWebBlacklist"); }, type: "text" },
  { key: "github.oauthClientId", get label() { return t("configFieldGithubOAuthClientId"); }, type: "text" },
  { key: "tui.theme", get label() { return t("configFieldTheme"); }, type: "select", options: themeNames },
  { key: "tui.compactMode", get label() { return t("configFieldCompactMode"); }, type: "toggle" },
  { key: "tui.showInputPreview", get label() { return t("configFieldShowInputPreview"); }, type: "toggle" },
  { key: "tui.language", get label() { return t("configFieldLanguage"); }, type: "select", options: ["en", "pt-BR"] },
];
