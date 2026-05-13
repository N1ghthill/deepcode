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

// Paleta moderna inspirada em editores contemporâneos (Tokyo Night / Catppuccin)
// Hex codes permitem cores ricas em qualquer terminal truecolor.
export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: "#1a1b26",
    bgSecondary: "#16161e",
    bgTertiary: "#1f2335",
    fg: "#c0caf5",
    fgMuted: "#565f89",
    border: "#3b4261",
    borderActive: "#7aa2f7",
    primary: "#7aa2f7",
    secondary: "#9ece6a",
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    accent: "#bb9af7",
    userMsg: "#7dcfff",
    assistantMsg: "#9ece6a",
    toolMsg: "#7aa2f7",
    systemMsg: "#565f89",
    selectionBg: "#3d59a1",
    selectionFg: "#c0caf5",
  },
  light: {
    bg: "#eff1f5",
    bgSecondary: "#e6e9ef",
    bgTertiary: "#ccd0da",
    fg: "#4c4f69",
    fgMuted: "#9ca0b0",
    border: "#bcc0cc",
    borderActive: "#1e66f5",
    primary: "#1e66f5",
    secondary: "#40a02b",
    success: "#40a02b",
    warning: "#df8e1d",
    error: "#d20f39",
    accent: "#8839ef",
    userMsg: "#04a5e5",
    assistantMsg: "#40a02b",
    toolMsg: "#1e66f5",
    systemMsg: "#9ca0b0",
    selectionBg: "#dce0e8",
    selectionFg: "#4c4f69",
  },
  "high-contrast": {
    bg: "#000000",
    bgSecondary: "#000000",
    bgTertiary: "#000000",
    fg: "#ffffff",
    fgMuted: "#cccccc",
    border: "#ffffff",
    borderActive: "#ffff00",
    primary: "#ffff00",
    secondary: "#00ffff",
    success: "#00ff00",
    warning: "#ffff00",
    error: "#ff0000",
    accent: "#00ffff",
    userMsg: "#00ffff",
    assistantMsg: "#00ff00",
    toolMsg: "#ffffff",
    systemMsg: "#cccccc",
    selectionBg: "#ffff00",
    selectionFg: "#000000",
  },
  nord: {
    bg: "#2e3440",
    bgSecondary: "#3b4252",
    bgTertiary: "#434c5e",
    fg: "#eceff4",
    fgMuted: "#677691",
    border: "#4c566a",
    borderActive: "#88c0d0",
    primary: "#88c0d0",
    secondary: "#a3be8c",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    accent: "#b48ead",
    userMsg: "#81a1c1",
    assistantMsg: "#a3be8c",
    toolMsg: "#88c0d0",
    systemMsg: "#677691",
    selectionBg: "#434c5e",
    selectionFg: "#eceff4",
  },
  dracula: {
    bg: "#282a36",
    bgSecondary: "#21222c",
    bgTertiary: "#44475a",
    fg: "#f8f8f2",
    fgMuted: "#6272a4",
    border: "#44475a",
    borderActive: "#bd93f9",
    primary: "#bd93f9",
    secondary: "#50fa7b",
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",
    accent: "#ff79c6",
    userMsg: "#8be9fd",
    assistantMsg: "#50fa7b",
    toolMsg: "#bd93f9",
    systemMsg: "#6272a4",
    selectionBg: "#44475a",
    selectionFg: "#f8f8f2",
  },
};

export function getTheme(name: string | undefined): ThemeColors {
  if (!name) return themes.dark;
  const themeName = name as ThemeName;
  if (themeName in themes) return themes[themeName];
  return themes.dark;
}

export const themeNames = Object.keys(themes);
