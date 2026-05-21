import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CommandKind, type SlashCommand } from "./types.js";

function memoryIndexPath(cwd: string): string {
  const slug = cwd.replace(/\//g, "-");
  return path.join(os.homedir(), ".claude", "projects", slug, "memory", "MEMORY.md");
}

function memoryDirPath(cwd: string): string {
  const slug = cwd.replace(/\//g, "-");
  return path.join(os.homedir(), ".claude", "projects", slug, "memory");
}

export const memoryCommand: SlashCommand = {
  name: "memory",
  description: "Mostra o índice de memória do projeto atual",
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: (context) => {
    const cwd = context.ui.getCwd?.() ?? process.cwd();
    const indexPath = memoryIndexPath(cwd);
    const memDir = memoryDirPath(cwd);

    let content: string;
    try {
      content = fs.readFileSync(indexPath, "utf8").trim();
    } catch {
      // Check if memory dir exists at all
      const dirExists = fs.existsSync(memDir);
      const msg = dirExists
        ? `Memória existe mas MEMORY.md não foi encontrado em:\n  ${indexPath}`
        : `Nenhuma memória encontrada para este projeto.\n  Esperado em: ${indexPath}`;
      context.ui.addItem({ type: "info", text: msg }, Date.now());
      return;
    }

    if (!content) {
      context.ui.addItem({ type: "info", text: "MEMORY.md está vazio." }, Date.now());
      return;
    }

    // Count memory files referenced in the index
    const fileRefs = (content.match(/\[.*?\]\(.*?\.md\)/g) ?? []).length;
    const header = `Memória do projeto (${fileRefs} entr${fileRefs !== 1 ? "adas" : "ada"}):\n`;
    context.ui.addItem({ type: "info", text: header + content }, Date.now());
  },
};
