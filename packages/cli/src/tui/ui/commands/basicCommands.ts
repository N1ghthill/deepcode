import {
  CommandKind,
  type OpenDialogActionReturn,
  type SlashCommand,
} from "./types.js";
import { t } from "../../i18n/index.js";

export const clearCommand: SlashCommand = {
  name: "clear",
  get description() {
    return t("Clear the on-screen conversation history");
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: (context) => {
    context.ui.clear();
  },
};

function helpAction(): OpenDialogActionReturn {
  return {
    type: "dialog",
    dialog: "help",
  };
}

export const helpCommand: SlashCommand = {
  name: "help",
  get description() {
    return t("Show available slash commands");
  },
  kind: CommandKind.BUILT_IN,
  supportedModes: ["interactive"] as const,
  action: () => helpAction(),
};
