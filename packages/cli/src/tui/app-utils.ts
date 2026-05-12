// Re-export from focused modules for backward compatibility.
// Consumers can import directly from utils/ modules as preferred.
export {
  recordAgentRunError,
  formatAgentRunError,
} from "./utils/error-utils.js";

export {
  getChatPreflightIssue,
} from "./utils/preflight-utils.js";

export {
  buildProviderHealthCheck,
  formatExpectedProviderTarget,
} from "./utils/provider-utils.js";

export {
  selectInitialSessionForLaunch,
  resolveLaunchSessionTarget,
} from "./utils/session-utils.js";

export {
  getRenderableChatMessages,
  isSidebarHotkeysEnabled,
} from "./utils/chat-utils.js";

export {
  getSlashCommandSuggestions,
  isSlashCommandInput,
  shouldUseSelectedSlashCommand,
  getSlashMenuAction,
} from "./utils/slash-command-utils.js";

export {
  getConfigValue,
  serializeConfigEditValue,
  serializeConfigDisplayValue,
  parseConfigEditValue,
  syncLegacyDefaultModel,
} from "./utils/config-utils.js";

export {
  extractTaskPlanFromSession,
  cloneTaskPlan,
} from "./utils/task-plan-utils.js";

export {
  getModelPricing,
} from "./utils/pricing-utils.js";

export {
  parseGithubLoginClientId,
  dedupeRecentModels,
} from "./utils/misc-utils.js";
