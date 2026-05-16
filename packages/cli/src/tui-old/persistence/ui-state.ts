import path from "node:path";
import fs from "node:fs/promises";
import type { ViewMode, VimMode } from "../types.js";
import type { SidebarTab } from "../components/layout/Sidebar.js";
import {
  quarantineCorruptFile,
  type AgentMode,
  type ProviderId,
  writeFileAtomic,
} from "@deepcode/shared";

export interface RecentModelSelection {
  provider: ProviderId;
  model: string;
}

export interface UIState {
  // Sessão
  lastActiveSessionId?: string;
  lastSessionTimestamp?: number;
  
  // UI State
  viewMode: ViewMode;
  sidebarTab: SidebarTab;
  agentMode: AgentMode;
  vimMode: VimMode;
  
  // Navegação
  selectedSessionIndex: number;
  inputHistory: string[];
  
  // Modais
  modals: {
    providerExpanded: boolean;
    modelFilter: string;
    recentModels: RecentModelSelection[];
  };
  
  // Metadata
  version: number;
  savedAt: string;
}

export class UIStateManager {
  private readonly filePath: string;
  
  constructor(worktree: string) {
    this.filePath = path.join(worktree, ".deepcode", "ui-state.json");
  }
  
  async load(): Promise<UIState | null> {
    try {
      await fs.access(this.filePath);
      const content = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(content) as UIState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      if ((error as NodeJS.ErrnoException).code !== "EACCES") {
        try {
          await quarantineCorruptFile(this.filePath);
        } catch {
          // Keep the TUI usable even if the quarantine attempt fails.
        }
      }
      return null;
    }
  }
  
  async save(state: UIState): Promise<void> {
    try {
      // Ensure .deepcode directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Save state
      await writeFileAtomic(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
    } catch {
      // Silently fail - don't crash the app if we can't save UI state
      console.warn("Failed to save UI state");
    }
  }
  
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch {
      // Silently fail - file might not exist
    }
  }
}
