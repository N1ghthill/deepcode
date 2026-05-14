import {
  hasAnyProviderCredentials,
  hasProviderCredentials,
  type AgentMode,
  type Session,
} from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { ChatPreflightIssue } from "../app-config.js";
import { PROVIDER_LABELS } from "../app-config.js";
import { resolveEffectiveModeProvider, resolveEffectiveModeSelection } from "../mode-routing.js";
import { t } from "../i18n/index.js";

export function getChatPreflightIssue(
  config: DeepCodeRuntime["config"],
  session: Session,
  mode: AgentMode = config.agentMode,
): ChatPreflightIssue | null {
  const selection = resolveEffectiveModeSelection(config, session, mode);
  const providerId = selection?.provider ?? resolveEffectiveModeProvider(config, session, mode);
  const providerName = providerLabel(providerId);
  const providerConfig = config.providers[providerId];
  const model = selection?.model;

  if (!hasAnyProviderCredentials(config)) {
    return {
      message: t("preflightNoProviderWithCredentials"),
      notice: t("preflightNoProviderShort"),
      modal: "provider",
    };
  }

  if (!hasProviderCredentials(providerConfig, providerId)) {
    return {
      message: t("preflightProviderNotConfigured", { provider: providerName }),
      notice: t("preflightProviderNoCredential", { provider: providerName }),
      modal: "provider",
    };
  }

  if (!model) {
    return {
      message: t("preflightNoModelForProvider", { provider: providerName }),
      notice: t("preflightNoModelShort", { provider: providerName }),
      modal: "model",
    };
  }

  return null;
}

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId as keyof typeof PROVIDER_LABELS] ?? providerId;
}
