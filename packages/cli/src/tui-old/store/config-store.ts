import { create } from "zustand";
import type { ProviderId, AgentMode } from "@deepcode/shared";

export interface ConfigStoreState {
  activeProvider: ProviderId;
  activeModel: string;
  agentMode: AgentMode;
  gitBranch: string;
  gitStatus: string;

  setActiveProvider: (p: ProviderId) => void;
  setActiveModel: (m: string) => void;
  setAgentMode: (m: AgentMode) => void;
  setGitBranch: (b: string) => void;
  setGitStatus: (s: string) => void;
}

export const useConfigStore = create<ConfigStoreState>()((set) => ({
  activeProvider: "openrouter",
  activeModel: "",
  agentMode: "build",
  gitBranch: "",
  gitStatus: "",

  setActiveProvider: (p) => set({ activeProvider: p }),
  setActiveModel: (m) => set({ activeModel: m }),
  setAgentMode: (m) => set({ agentMode: m }),
  setGitBranch: (b) => set({ gitBranch: b }),
  setGitStatus: (s) => set({ gitStatus: s }),
}));
