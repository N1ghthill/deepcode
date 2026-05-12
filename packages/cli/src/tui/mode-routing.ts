import {
  hasProviderCredentials,
  resolveConfiguredModelForProvider,
  resolveUsableProviderTarget,
  type AgentMode,
  type DeepCodeConfig,
  type ProviderId,
  type Session,
} from "@deepcode/shared";
import type { ModelSelection } from "./model-selection.js";

type ModeRoutingConfig = Pick<
  DeepCodeConfig,
  "defaultProvider" | "defaultModel" | "defaultModels" | "modeDefaults" | "providers"
>;

export function resolveModeSelection(
  config: ModeRoutingConfig,
  session: Pick<Session, "provider" | "model">,
  mode: AgentMode,
): ModelSelection | null {
  const modeOverride = config.modeDefaults?.[mode];
  const provider = modeOverride?.provider ?? session.provider ?? config.defaultProvider;
  const modeModel = modeOverride?.provider && modeOverride.provider !== provider
    ? undefined
    : modeOverride?.model;
  const model = modeModel
    ?? (provider === session.provider ? session.model : undefined)
    ?? resolveConfiguredModelForProvider(config, provider);

  if (!model) {
    return null;
  }

  return { provider, model };
}

export function resolveModeProvider(
  config: ModeRoutingConfig,
  session: Pick<Session, "provider" | "model">,
  mode: AgentMode,
): ProviderId {
  return resolveModeSelection(config, session, mode)?.provider
    ?? config.modeDefaults?.[mode]?.provider
    ?? session.provider
    ?? config.defaultProvider;
}

export function resolveEffectiveModeSelection(
  config: ModeRoutingConfig,
  session: Pick<Session, "provider" | "model">,
  mode: AgentMode,
): ModelSelection | null {
  const preferred = resolveModeSelection(config, session, mode);
  if (preferred && hasProviderCredentials(config.providers[preferred.provider]) && preferred.model) {
    return preferred;
  }

  const fallback = resolveUsableProviderTarget(config, [
    config.modeDefaults?.[mode]?.provider,
    session.provider,
  ]);

  if (!fallback.model) {
    return null;
  }

  return {
    provider: fallback.provider,
    model: fallback.model,
  };
}

export function resolveEffectiveModeProvider(
  config: ModeRoutingConfig,
  session: Pick<Session, "provider" | "model">,
  mode: AgentMode,
): ProviderId {
  return resolveEffectiveModeSelection(config, session, mode)?.provider
    ?? resolveUsableProviderTarget(config, [
      config.modeDefaults?.[mode]?.provider,
      session.provider,
    ]).provider;
}
