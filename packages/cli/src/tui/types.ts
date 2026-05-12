export type ViewMode = "chat" | "sessions" | "config" | "help";
export type VimMode = "insert" | "normal";
export type ModalType = "provider" | "model" | "telemetry" | null;

export interface AppProps {
  cwd: string;
  config?: string;
}
