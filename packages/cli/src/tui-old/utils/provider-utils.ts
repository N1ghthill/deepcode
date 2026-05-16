import {
  resolveConfiguredModelForProvider,
  type AgentMode,
  type ProviderId,
  type Session,
} from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import { formatModelSelection } from "../model-selection.js";
import { resolveEffectiveModeSelection } from "../mode-routing.js";

export function buildProviderHealthCheck(
  runtime: Pick<DeepCodeRuntime, "config" | "providers">,
  session: Pick<Session, "provider" | "model">,
  providerId: ProviderId,
  mode: AgentMode = runtime.config.agentMode ?? "build",
): {
  validateConfig: (options?: { signal?: AbortSignal }) => Promise<boolean>;
  validateProviderModel?: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  modelUnderTest?: string;
} {
  const provider = runtime.providers.get(providerId);
  const modelUnderTest = resolveProviderValidationModel(runtime.config, session, providerId, mode);

  return {
    validateConfig: async (options) => {
      await provider.listModels(options);
      return true;
    },
    validateProviderModel: modelUnderTest
      ? async () =>
          runtime.providers.validateProviderModel(providerId, {
            model: modelUnderTest,
            timeoutMs: 5_000,
          })
      : undefined,
    modelUnderTest,
  };
}

export function formatExpectedProviderTarget(
  config: Pick<DeepCodeRuntime["config"], "defaultModel" | "defaultModels" | "defaultProvider" | "modeDefaults" | "providers">,
  session: Pick<Session, "provider" | "model">,
  providerId: ProviderId,
  mode: AgentMode,
): string | undefined {
  const model = resolveProviderValidationModel(config, session, providerId, mode);
  if (!model) {
    return undefined;
  }

  return formatModelSelection({ provider: providerId, model });
}

function resolveProviderValidationModel(
  config: Pick<DeepCodeRuntime["config"], "defaultModel" | "defaultModels" | "defaultProvider" | "modeDefaults" | "providers">,
  session: Pick<Session, "provider" | "model">,
  providerId: ProviderId,
  mode: AgentMode,
): string | undefined {
  const activeSelection = resolveEffectiveModeSelection(config, session, mode);
  if (activeSelection?.provider === providerId) {
    return activeSelection.model;
  }
  return resolveConfiguredModelForProvider(config, providerId);
}
