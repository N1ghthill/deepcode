import type { ProviderId } from "@deepcode/shared";
import type { RecentModelSelection } from "../persistence/ui-state.js";
import { formatModelSelection } from "../model-selection.js";

export function parseGithubLoginClientId(command: string): string | undefined {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part === "--client-id") {
      const value = parts[index + 1];
      return value && !value.startsWith("-") ? value : undefined;
    }
    if (part?.startsWith("--client-id=")) {
      return part.slice("--client-id=".length) || undefined;
    }
  }
  if (parts[0] === "/github-login" && parts[1] && !parts[1].startsWith("-")) {
    return parts[1];
  }
  if (parts[0] === "/github" && parts[1] === "login" && parts[2] && !parts[2].startsWith("-")) {
    return parts[2];
  }
  return undefined;
}

export function dedupeRecentModels(models: RecentModelSelection[]): RecentModelSelection[] {
  const next: RecentModelSelection[] = [];
  const seen = new Set<string>();

  for (const model of models) {
    const key = formatModelSelection(model);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(model);
    if (next.length >= 8) {
      break;
    }
  }

  return next;
}
