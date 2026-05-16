import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UIStateManager } from "../../src/tui/persistence/ui-state.js";

// Mock fs module
vi.mock("node:fs/promises");

describe("UIStateManager", () => {
  const worktree = "/test/worktree";
  let uiStateManager: UIStateManager;
  
  beforeEach(() => {
    uiStateManager = new UIStateManager(worktree);
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it("should create file path correctly", () => {
    expect(uiStateManager).toBeDefined();
  });
  
  it("should load state when file exists", async () => {
    const mockState = {
      lastActiveSessionId: "test-session",
      viewMode: "chat" as const,
      sidebarTab: "activities" as const,
      agentMode: "build" as const,
      vimMode: "insert" as const,
      selectedSessionIndex: 0,
      inputHistory: ["test"],
      modals: {
        providerExpanded: false,
        modelFilter: "",
        recentModels: [],
      },
      version: 1,
      savedAt: new Date().toISOString(),
    };
    
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockState));
    
    const result = await uiStateManager.load();
    
    expect(result).toEqual(mockState);
    expect(fs.access).toHaveBeenCalledWith(path.join(worktree, ".deepcode", "ui-state.json"));
    expect(fs.readFile).toHaveBeenCalledWith(path.join(worktree, ".deepcode", "ui-state.json"), "utf-8");
  });
  
  it("should return null when file doesn't exist", async () => {
    (fs.access as jest.Mock).mockRejectedValue(new Error("File not found"));
    
    const result = await uiStateManager.load();
    
    expect(result).toBeNull();
  });
  
  it("should save state correctly", async () => {
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.rename as jest.Mock).mockResolvedValue(undefined);
    
    const state = {
      lastActiveSessionId: "test-session",
      viewMode: "chat" as const,
      sidebarTab: "activities" as const,
      agentMode: "build" as const,
      vimMode: "insert" as const,
      selectedSessionIndex: 0,
      inputHistory: ["test"],
      modals: {
        providerExpanded: false,
        modelFilter: "",
        recentModels: [],
      },
      version: 1,
      savedAt: new Date().toISOString(),
    };
    
    await uiStateManager.save(state);
    
    expect(fs.mkdir).toHaveBeenCalledWith(path.join(worktree, ".deepcode"), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringContaining(path.join(worktree, ".deepcode", ".ui-state.json")),
      path.join(worktree, ".deepcode", "ui-state.json"),
    );
    expect((fs.writeFile as jest.Mock).mock.calls[0]?.[1]).toBe(`${JSON.stringify(state, null, 2)}\n`);
  });
  
  it("should handle save errors gracefully", async () => {
    (fs.mkdir as jest.Mock).mockRejectedValue(new Error("Permission denied"));
    
    const state = {
      lastActiveSessionId: "test-session",
      viewMode: "chat" as const,
      sidebarTab: "activities" as const,
      agentMode: "build" as const,
      vimMode: "insert" as const,
      selectedSessionIndex: 0,
      inputHistory: ["test"],
      modals: {
        providerExpanded: false,
        modelFilter: "",
        recentModels: [],
      },
      version: 1,
      savedAt: new Date().toISOString(),
    };
    
    // Should not throw error
    await expect(uiStateManager.save(state)).resolves.toBeUndefined();
  });
  
  it("should clear state correctly", async () => {
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    
    await uiStateManager.clear();
    
    expect(fs.unlink).toHaveBeenCalledWith(path.join(worktree, ".deepcode", "ui-state.json"));
  });
  
  it("should handle clear errors gracefully", async () => {
    (fs.unlink as jest.Mock).mockRejectedValue(new Error("File not found"));
    
    // Should not throw error
    await expect(uiStateManager.clear()).resolves.toBeUndefined();
  });

  it("should quarantine invalid saved state", async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue("{");
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.rename as jest.Mock).mockResolvedValue(undefined);

    const result = await uiStateManager.load();

    expect(result).toBeNull();
    expect(fs.rename).toHaveBeenCalledWith(
      path.join(worktree, ".deepcode", "ui-state.json"),
      expect.stringContaining(path.join(worktree, ".deepcode", "corrupt", "ui-state.json")),
    );
  });
});
