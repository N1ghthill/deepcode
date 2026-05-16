import { describe, expect, it } from "vitest";
import {
  getConfigValue,
  serializeConfigEditValue,
  serializeConfigDisplayValue,
  parseConfigEditValue,
  syncLegacyDefaultModel,
} from "../../src/tui/utils/config-utils.js";

describe("config-utils", () => {
  describe("getConfigValue", () => {
    it("retrieves nested values", () => {
      const config = { providers: { openrouter: { apiKey: "secret" } } };
      expect(getConfigValue(config, "providers.openrouter.apiKey")).toBe("secret");
    });

    it("returns undefined for missing keys", () => {
      expect(getConfigValue({}, "providers.openrouter.apiKey")).toBeUndefined();
    });

    it("handles top-level keys", () => {
      expect(getConfigValue({ defaultProvider: "openrouter" }, "defaultProvider")).toBe("openrouter");
    });
  });

  describe("serializeConfigEditValue", () => {
    it("stringifies arrays and objects", () => {
      expect(serializeConfigEditValue(["a", "b"])).toBe('["a","b"]');
      expect(serializeConfigEditValue({ key: "value" })).toBe('{"key":"value"}');
    });

    it("passes through strings", () => {
      expect(serializeConfigEditValue("hello")).toBe("hello");
    });

    it("converts numbers and booleans", () => {
      expect(serializeConfigEditValue(42)).toBe("42");
      expect(serializeConfigEditValue(true)).toBe("true");
    });

    it("returns empty for null/undefined", () => {
      expect(serializeConfigEditValue(null)).toBe("");
      expect(serializeConfigEditValue(undefined)).toBe("");
    });
  });

  describe("serializeConfigDisplayValue", () => {
    it("shows dash for undefined", () => {
      expect(serializeConfigDisplayValue(undefined)).toBe("—");
    });

    it("stringifies arrays and objects", () => {
      expect(serializeConfigDisplayValue(["a"])).toBe('["a"]');
    });

    it("converts other values to string", () => {
      expect(serializeConfigDisplayValue(42)).toBe("42");
      expect(serializeConfigDisplayValue(true)).toBe("true");
    });
  });

  describe("parseConfigEditValue", () => {
    it("parses numbers", () => {
      expect(parseConfigEditValue("42", 0, "number")).toBe(42);
    });

    it("parses toggles", () => {
      expect(parseConfigEditValue("true", false, "toggle")).toBe(true);
      expect(parseConfigEditValue("false", true, "toggle")).toBe(false);
      expect(parseConfigEditValue("1", false, "toggle")).toBe(true);
      expect(parseConfigEditValue("0", true, "toggle")).toBe(false);
    });

    it("parses JSON for array/object current values", () => {
      expect(parseConfigEditValue('["a","b"]', [], "text")).toEqual(["a", "b"]);
      expect(parseConfigEditValue('{"k":"v"}', {}, "text")).toEqual({ k: "v" });
    });

    it("returns raw string for simple values", () => {
      expect(parseConfigEditValue("hello", "", "text")).toBe("hello");
    });
  });

  describe("syncLegacyDefaultModel", () => {
    it("syncs defaultModel from provider-specific default", () => {
      const config = {
        defaultProvider: "openrouter",
        defaultModels: { openrouter: "gpt-4" },
      };
      syncLegacyDefaultModel(config);
      expect(config.defaultModel).toBe("gpt-4");
    });

    it("deletes defaultModel when provider default is empty", () => {
      const config = {
        defaultProvider: "openrouter",
        defaultModels: { openrouter: "" },
        defaultModel: "old-model",
      };
      syncLegacyDefaultModel(config);
      expect(config.defaultModel).toBeUndefined();
    });

    it("deletes defaultModel when defaultProvider is not a string", () => {
      const config = { defaultModel: "old-model" };
      syncLegacyDefaultModel(config);
      expect(config.defaultModel).toBeUndefined();
    });
  });
});
