import { CommandKind, type SlashCommand } from "./types.js";

const YOLO_MODES = {
  read: "allow",
  write: "allow",
  gitLocal: "allow",
  shell: "allow",
  dangerous: "allow",
} as const;

const SAFE_MODES = {
  read: "allow",
  write: "ask",
  gitLocal: "allow",
  shell: "ask",
  dangerous: "ask",
} as const;

export const yoloCommand: SlashCommand = {
  name: "yolo",
  description: "Define todas as permissões como 'allow' (sem confirmações)",
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: (context) => {
    context.ui.setPermissions?.(YOLO_MODES);
    context.ui.addItem(
      { type: "info", text: "Modo YOLO ativado: todas as ferramentas aprovadas automaticamente." },
      Date.now(),
    );
  },
};

export const safeCommand: SlashCommand = {
  name: "safe",
  description: "Restaura permissões padrão (write e shell pedem confirmação)",
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: (context) => {
    context.ui.setPermissions?.(SAFE_MODES);
    context.ui.addItem(
      { type: "info", text: "Permissões restauradas: escrita e shell voltam a pedir confirmação." },
      Date.now(),
    );
  },
};
