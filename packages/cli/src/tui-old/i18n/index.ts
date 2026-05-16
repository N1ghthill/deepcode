import { en } from "./en";
import { ptBR } from "./pt-br";

export type I18nKey = keyof typeof en;
export type I18nDict = Record<I18nKey, string>;

export { en };
export { ptBR };

export type Language = "en" | "pt-BR";

export const LANGUAGES: Record<string, string> = {
  en: "English",
  "pt-BR": "Portugu\u00EAs (Brasil)",
};

const dicts: Record<Language, I18nDict> = {
  en,
  "pt-BR": ptBR,
};

let currentLanguage: Language = "en";
let currentDict: I18nDict = en;

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
  currentDict = dicts[lang] ?? en;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(
  key: I18nKey,
  params?: Record<string, string | number>,
): string {
  let value = currentDict[key] ?? en[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(
        new RegExp(`\\{${paramKey}\\}`, "g"),
        String(paramValue),
      );
    }
  }
  return value;
}