import path from "node:path";
import { describe, expect, it } from "vitest";
import { pickLanguageServer, type LanguageServerConfig } from "../src/lsp/lsp-client.js";

const servers: LanguageServerConfig[] = [
  { languages: ["typescript"], command: "typescript-language-server", args: ["--stdio"], fileExtensions: [".ts"] },
  { languages: ["python"], command: "pylsp", args: [], fileExtensions: [".py"] },
];

describe("pickLanguageServer", () => {
  it("selects by file extension", () => {
    expect(pickLanguageServer(servers, "/tmp/project", path.join("/tmp/project", "app.py"))?.command).toBe("pylsp");
  });

  it("falls back to the first configured server", () => {
    expect(pickLanguageServer(servers, "/tmp/project", path.join("/tmp/project", "README.md"))?.command).toBe(
      "typescript-language-server",
    );
  });
});
