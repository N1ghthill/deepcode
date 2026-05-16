import { ProviderIdSchema, type ProviderId } from "@deepcode/shared";

export interface ModelSelection {
  provider: ProviderId;
  model: string;
}

export function formatModelSelection(selection: ModelSelection): string {
  return `${selection.provider}/${selection.model}`;
}

export function parseModelSelection(
  value: string,
  fallbackProvider?: ProviderId,
): ModelSelection | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const [candidateProvider, ...rest] = trimmed.split("/");
  const parsedProvider = ProviderIdSchema.safeParse(candidateProvider);
  if (parsedProvider.success && rest.length > 0) {
    return {
      provider: parsedProvider.data,
      model: rest.join("/"),
    };
  }

  if (!fallbackProvider) {
    return null;
  }

  return {
    provider: fallbackProvider,
    model: trimmed,
  };
}
