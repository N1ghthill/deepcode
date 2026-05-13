export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  fg: string;
  fgMuted: string;
  border: string;
  borderActive: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  accent: string;
  userMsg: string;
  assistantMsg: string;
  toolMsg: string;
  systemMsg: string;
  selectionBg: string;
  selectionFg: string;
}

export type ThemeName = "dark" | "light" | "high-contrast" | "nord" | "dracula";

export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: "black",
    bgSecondary: "black",
    bgTertiary: "black",
    fg: "white",
    fgMuted: "gray",
    border: "gray",
    borderActive: "blueBright",
    primary: "cyanBright",
    secondary: "greenBright",
    success: "greenBright",
    warning: "yellowBright",
    error: "redBright",
    accent: "magentaBright",
    userMsg: "cyanBright",
    assistantMsg: "greenBright",
    toolMsg: "gray",
    systemMsg: "gray",
    selectionBg: "blue",
    selectionFg: "white",
  },
  light: {
    bg: "white",
    bgSecondary: "white",
    bgTertiary: "white",
    fg: "black",
    fgMuted: "gray",
    border: "gray",
    borderActive: "blue",
    primary: "blue",
    secondary: "green",
    success: "green",
    warning: "yellow",
    error: "red",
    accent: "magenta",
    userMsg: "blue",
    assistantMsg: "green",
    toolMsg: "gray",
    systemMsg: "gray",
    selectionBg: "blue",
    selectionFg: "white",
  },
  "high-contrast": {
    bg: "black",
    bgSecondary: "black",
    bgTertiary: "black",
    fg: "white",
    fgMuted: "white",
    border: "white",
    borderActive: "yellow",
    primary: "yellow",
    secondary: "cyan",
    success: "green",
    warning: "yellow",
    error: "red",
    accent: "cyan",
    userMsg: "cyan",
    assistantMsg: "green",
    toolMsg: "white",
    systemMsg: "white",
    selectionBg: "yellow",
    selectionFg: "black",
  },
  nord: {
    bg: "black",
    bgSecondary: "black",
    bgTertiary: "black",
    fg: "white",
    fgMuted: "gray",
    border: "gray",
    borderActive: "cyan",
    primary: "cyan",
    secondary: "green",
    success: "green",
    warning: "yellow",
    error: "red",
    accent: "magenta",
    userMsg: "cyan",
    assistantMsg: "green",
    toolMsg: "gray",
    systemMsg: "gray",
    selectionBg: "blue",
    selectionFg: "white",
  },
  dracula: {
    bg: "black",
    bgSecondary: "black",
    bgTertiary: "black",
    fg: "white",
    fgMuted: "gray",
    border: "magenta",
    borderActive: "cyan",
    primary: "cyan",
    secondary: "green",
    success: "green",
    warning: "yellow",
    error: "red",
    accent: "magenta",
    userMsg: "cyan",
    assistantMsg: "green",
    toolMsg: "gray",
    systemMsg: "gray",
    selectionBg: "magenta",
    selectionFg: "white",
  },
};

export function getTheme(name: string | undefined): ThemeColors {
  if (!name) return themes.dark;
  const themeName = name as ThemeName;
  if (themeName in themes) return themes[themeName];
  return themes.dark;
}

export const themeNames = Object.keys(themes);
