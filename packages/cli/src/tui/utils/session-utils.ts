import {
  resolveUsableProviderTarget,
  type AgentMode,
  type ProviderId,
  type Session,
} from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { InitialSessionSelection } from "../app-config.js";
import { resolveEffectiveModeSelection } from "../mode-routing.js";

export function selectInitialSessionForLaunch(
  sessions: Session[],
  config: Pick<DeepCodeRuntime["config"], "defaultProvider" | "defaultModel" | "defaultModels" | "modeDefaults" | "agentMode" | "providers">,
): InitialSessionSelection {
  const reusable = sessions.find((session) => isReusableBlankSession(session));
  if (reusable) {
    return { type: "reuse", session: reusable };
  }
  return {
    type: "create",
    ...resolveLaunchSessionTarget(config, config.agentMode),
  };
}

export function resolveLaunchSessionTarget(
  config: Pick<DeepCodeRuntime["config"], "defaultProvider" | "defaultModel" | "defaultModels" | "modeDefaults" | "providers">,
  mode: AgentMode,
): { provider: ProviderId; model?: string } {
  const fallback = resolveUsableProviderTarget(config, [config.defaultProvider]);
  const selection = resolveEffectiveModeSelection(
    config,
    {
      provider: fallback.provider,
      model: fallback.model,
    },
    mode,
  );

  return {
    provider: selection?.provider ?? fallback.provider,
    model: selection?.model ?? fallback.model,
  };
}

function isReusableBlankSession(session: Session): boolean {
  return (
    !session.metadata?.deletedAt &&
    session.status === "idle" &&
    session.messages.length === 0 &&
    session.activities.length === 0
  );
}
