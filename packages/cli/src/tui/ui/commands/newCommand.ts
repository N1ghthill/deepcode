import { CommandKind, type SlashCommand } from "./types.js";

export const newCommand: SlashCommand = {
  name: "new",
  description: "Inicia uma nova sessão em branco (mantém provider/modelo atual)",
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: async (context) => {
    await context.ui.newSession?.();
  },
};
