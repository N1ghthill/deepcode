/**
 * Minimal i18n for the DeepCode TUI.
 *
 * Qwen Code ships a full locale system; its translation *keys are English
 * strings*, so an identity `t()` (with `{{param}}` interpolation) renders
 * correctly in English without the locale machinery. Locale support can be
 * layered back in later by replacing this module.
 */

export type SupportedLanguage = "en";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ["en"];

/** Translate (identity) with `{{param}}` interpolation. */
export function t(key: string, params?: Record<string, string | number>): string {
  if (!params) return key;
  return key.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Translate to a string array — minimal stub returns the key as one line. */
export function ta(key: string): string[] {
  return [key];
}

export function getCurrentLanguage(): SupportedLanguage {
  return "en";
}

export function setLanguage(_lang: SupportedLanguage | "auto"): void {}

export async function initializeI18n(): Promise<void> {}
