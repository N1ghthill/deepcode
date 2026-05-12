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
      message: "Nenhum provider com credenciais está configurado. Abra o menu de providers com Ctrl+P ou use /provider para definir uma credencial antes de enviar mensagens.",
      notice: "Nenhum provider configurado. Abra Ctrl+P ou use /provider.",
      modal: "provider",
    };
  }

  if (!hasProviderCredentials(providerConfig)) {
    return {
      message: `${providerName} ainda não está configurado. Abra o menu de providers com Ctrl+P ou use /provider para definir a credencial antes de enviar mensagens.`,
      notice: `${providerName} sem credencial. Abra Ctrl+P ou use /provider.`,
      modal: "provider",
    };
  }

  if (!model) {
    return {
      message: `Nenhum modelo está configurado para ${providerName}. Abra Ctrl+M ou use /model para escolher um modelo antes de continuar.`,
      notice: `Nenhum modelo configurado para ${providerName}. Abra Ctrl+M ou use /model.`,
      modal: "model",
    };
  }

  return null;
}

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId as keyof typeof PROVIDER_LABELS] ?? providerId;
}
