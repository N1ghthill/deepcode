export type ViewMode = "chat" | "sessions" | "config" | "help" | "timeline";
export type VimMode = "insert" | "normal";
export type ModalType = "provider" | "model" | "telemetry" | null;
export type DetailContent = "none" | "timeline" | "config" | "diff";

export interface AppProps {
  cwd: string;
  config?: string;
}
