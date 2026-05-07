import { analyzeCodeTool, lintTool, testTool } from "./code-tools.js";
import { editFileTool, listDirTool, readFileTool, writeFileTool } from "./file-tools.js";
import { gitTool } from "./git-tool.js";
import { searchFilesTool, searchSymbolsTool, searchTextTool } from "./search-tools.js";
import { bashTool } from "./shell-tool.js";
import { ToolRegistry } from "./tool.js";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(listDirTool);
  registry.register(searchTextTool);
  registry.register(searchFilesTool);
  registry.register(searchSymbolsTool);
  registry.register(analyzeCodeTool);
  registry.register(lintTool);
  registry.register(testTool);
  registry.register(bashTool);
  registry.register(gitTool);
  return registry;
}
