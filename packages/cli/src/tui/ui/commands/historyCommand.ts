import { CommandKind, type SlashCommand } from "./types.js";

const DEFAULT_SHOW = 5;

export const historyCommand: SlashCommand = {
  name: "history",
  description: "Mostra o resumo e últimos prompts da sessão atual",
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: (context, args) => {
    const messages = context.ui.getMessages?.() ?? [];

    const userMessages = messages.filter((m) => m.role === "user");
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const total = messages.length;
    const showN = Math.min(Number.parseInt(args?.trim() || String(DEFAULT_SHOW), 10) || DEFAULT_SHOW, userMessages.length);

    const lines: string[] = [
      `Sessão: ${total} mensagens (${userMessages.length} do usuário, ${assistantMessages.length} do assistente)`,
      "",
    ];

    if (userMessages.length === 0) {
      lines.push("Nenhuma mensagem ainda.");
    } else {
      lines.push(`Últimos ${showN} prompt${showN !== 1 ? "s" : ""}:`);
      const slice = userMessages.slice(-showN);
      for (let i = 0; i < slice.length; i++) {
        const msg = slice[i];
        const raw: unknown = msg.content;
        const content = typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? (raw as Array<unknown>)
              .filter((p): p is { type: string; text: string } => typeof p === "object" && p !== null && (p as Record<string, unknown>)["type"] === "text")
              .map((p) => p.text)
              .join(" ")
            : String(raw);
        const preview = content.replace(/\n+/g, " ").trim().slice(0, 80);
        const n = userMessages.length - showN + i + 1;
        lines.push(`  ${n}. ${preview}${content.length > 80 ? "…" : ""}`);
      }
    }

    context.ui.addItem({ type: "info", text: lines.join("\n") }, Date.now());
  },
};
