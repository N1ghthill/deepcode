import type { ConfigFieldDef } from "../app-config.js";

export function getConfigValue(config: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function serializeConfigEditValue(value: unknown): string {
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function serializeConfigDisplayValue(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return JSON.stringify(value);
  }
  return String(value);
}

export function parseConfigEditValue(
  rawValue: string,
  currentValue: unknown,
  fieldType: ConfigFieldDef["type"],
): unknown {
  if (fieldType === "number") {
    return Number(rawValue);
  }
  if (fieldType === "toggle") {
    return ["true", "1", "yes", "on"].includes(rawValue.toLowerCase());
  }
  if (Array.isArray(currentValue) || isPlainObject(currentValue)) {
    return JSON.parse(rawValue) as unknown;
  }
  return rawValue;
}

export function syncLegacyDefaultModel(config: Record<string, unknown>): void {
  const defaultProvider = config.defaultProvider;
  if (typeof defaultProvider !== "string") {
    delete config.defaultModel;
    return;
  }

  const providerDefault = getConfigValue(config, `defaultModels.${defaultProvider}`);
  if (typeof providerDefault === "string" && providerDefault.trim().length > 0) {
    config.defaultModel = providerDefault;
    return;
  }

  delete config.defaultModel;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
