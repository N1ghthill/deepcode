import { describe, expect, it } from "vitest";
import {
  getSlashCommandSuggestions,
  isSlashCommandInput,
  shouldUseSelectedSlashCommand,
  getSlashMenuAction,
} from "../../src/tui/utils/slash-command-utils.js";

describe("slash-command-utils", () => {
  describe("getSlashCommandSuggestions", () => {
    it("returns empty for non-slash input", () => {
      expect(getSlashCommandSuggestions("hello")).toHaveLength(0);
    });

    it("returns all commands for bare slash", () => {
      const suggestions = getSlashCommandSuggestions("/");
      expect(suggestions.length).toBeGreaterThan(5);
    });

    it("filters by prefix", () => {
      const suggestions = getSlashCommandSuggestions("/mod");
      expect(suggestions.map((s) => s.command)).toContain("/model");
    });
  });

  describe("isSlashCommandInput", () => {
    it("recognizes valid slash commands", () => {
      expect(isSlashCommandInput("/provider")).toBe(true);
      expect(isSlashCommandInput("/model")).toBe(true);
      expect(isSlashCommandInput("/config")).toBe(true);
      expect(isSlashCommandInput("/help")).toBe(true);
      expect(isSlashCommandInput("/new")).toBe(true);
      expect(isSlashCommandInput("/clear")).toBe(true);
      expect(isSlashCommandInput("/sessions")).toBe(true);
      expect(isSlashCommandInput("/mode plan")).toBe(true);
    });

    it("rejects filesystem paths", () => {
      expect(isSlashCommandInput("/home/user")).toBe(false);
      expect(isSlashCommandInput("/tmp")).toBe(false);
      expect(isSlashCommandInput("/etc/config")).toBe(false);
    });
  });

  describe("shouldUseSelectedSlashCommand", () => {
    const cmd = { command: "/github-login", label: "GitHub login", description: "Login" };

    it("allows bare slash", () => {
      expect(shouldUseSelectedSlashCommand("/", cmd)).toBe(true);
    });

    it("allows partial match", () => {
      expect(shouldUseSelectedSlashCommand("/git", cmd)).toBe(true);
    });

    it("rejects exact match (no replacement needed)", () => {
      expect(shouldUseSelectedSlashCommand("/github-login", cmd)).toBe(false);
    });

    it("rejects input with spaces (user is typing args)", () => {
      expect(shouldUseSelectedSlashCommand("/github-login --client-id", cmd)).toBe(false);
    });
  });

  describe("getSlashMenuAction", () => {
    const suggestions = getSlashCommandSuggestions("/git");

    it("returns null when menu is not shown", () => {
      expect(
        getSlashMenuAction({
          showSlashMenu: false,
          slashCommandSuggestions: suggestions,
          selectedSlashCommandIndex: 0,
          input: "/git",
          inputChar: "",
          key: {},
        }),
      ).toBeNull();
    });

    it("moves selection on down arrow", () => {
      expect(
        getSlashMenuAction({
          showSlashMenu: true,
          slashCommandSuggestions: suggestions,
          selectedSlashCommandIndex: 0,
          input: "/git",
          inputChar: "",
          key: { downArrow: true },
        }),
      ).toEqual({ type: "move", selectedIndex: 0 });
    });

    it("closes on escape", () => {
      expect(
        getSlashMenuAction({
          showSlashMenu: true,
          slashCommandSuggestions: suggestions,
          selectedSlashCommandIndex: 0,
          input: "/git",
          inputChar: "",
          key: { escape: true },
        }),
      ).toEqual({ type: "close" });
    });
  });
});
