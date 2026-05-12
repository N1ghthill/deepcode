import {
  collectSecretValues,
  redactText,
  traverseErrorChain,
} from "@deepcode/core";
import type { Session } from "@deepcode/shared";
import type { DeepCodeRuntime } from "../../runtime.js";
import { PROVIDER_LABELS } from "../app-config.js";

export async function recordAgentRunError(
  activeRuntime: DeepCodeRuntime,
  activeSession: Session,
  err: unknown,
): Promise<string> {
  const message = formatAgentRunError(activeRuntime, activeSession, err);
  activeSession.status = "error";
  activeRuntime.sessions.addMessage(activeSession.id, {
    role: "assistant",
    source: "ui",
    content: `Erro ao executar a tarefa: ${message}`,
  });
  try {
    await activeRuntime.sessions.persist(activeSession.id);
  } catch {
    // Keep the TUI usable even if the session error cannot be persisted.
  }
  return message;
}

export function formatAgentRunError(
  activeRuntime: DeepCodeRuntime,
  activeSession: Session,
  err: unknown,
): string {
  const providerName = providerLabel(activeSession.provider);
  const rawMessage = err instanceof Error ? err.message : String(err);
  const redactedRawMessage = redactText(rawMessage, collectSecretValues(activeRuntime.config));
  const messages = traverseErrorChain(err).map((message) =>
    redactText(message, collectSecretValues(activeRuntime.config)),
  );

  if (messages.some((message) => /missing api key/i.test(message))) {
    return `${providerName} está sem API key. Abra Ctrl+P ou use /provider para configurar a credencial.`;
  }

  if (messages.some((message) => /no model configured/i.test(message))) {
    return `Nenhum modelo está configurado para ${providerName}. Abra Ctrl+M ou use /model antes de continuar.`;
  }

  if (messages.some((message) => /authentication failed/i.test(message))) {
    return `${providerName} rejeitou a autenticação. Revise a API key no menu de providers (Ctrl+P ou /provider).`;
  }

  if (messages.some((message) => /request timed out|network request failed/i.test(message))) {
    return `${providerName} não respondeu corretamente. Verifique conectividade, base URL e tente novamente.`;
  }

  return redactedRawMessage;
}

function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId as keyof typeof PROVIDER_LABELS] ?? providerId;
}
