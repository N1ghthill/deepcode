import {
  SLASH_COMMANDS,
  type SlashCommandDef,
  type SlashMenuAction,
  type SlashMenuKeyState,
} from "../app-config.js";

const SLASH_COMMAND_INPUTS = [
  ...SLASH_COMMANDS.map((item) => item.command),
  "/providers",
  "/models",
  "/github login",
];

export function getSlashCommandSuggestions(input: string): SlashCommandDef[] {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.startsWith("/")) return [];
  if (trimmed === "/") return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter((item) => {
    const haystack = `${item.command} ${item.label} ${item.description}`.toLowerCase();
    return item.command.toLowerCase().startsWith(trimmed) || haystack.includes(trimmed.slice(1));
  });
}

export function isSlashCommandInput(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed.startsWith("/")) return false;

  const inputTokens = trimmed.split(/\s+/).filter(Boolean);
  return SLASH_COMMAND_INPUTS.some((command) => matchesSlashCommandTokens(inputTokens, command));
}

export function shouldUseSelectedSlashCommand(input: string, selected: SlashCommandDef): boolean {
  const trimmed = input.trim();
  if (trimmed === "/") return true;
  if (!trimmed.startsWith("/")) return false;
  if (/\s/.test(trimmed)) return false;
  return selected.command !== trimmed && selected.command.startsWith(trimmed);
}

export function getSlashMenuAction({
  showSlashMenu,
  slashCommandSuggestions,
  selectedSlashCommandIndex,
  input,
  inputChar,
  key,
}: {
  showSlashMenu: boolean;
  slashCommandSuggestions: SlashCommandDef[];
  selectedSlashCommandIndex: number;
  input: string;
  inputChar: string;
  key: SlashMenuKeyState;
}): SlashMenuAction | null {
  if (!showSlashMenu || slashCommandSuggestions.length === 0) return null;

  if (key.upArrow) {
    return {
      type: "move",
      selectedIndex: Math.max(0, selectedSlashCommandIndex - 1),
    };
  }
  if (key.downArrow || key.tab) {
    return {
      type: "move",
      selectedIndex: Math.min(slashCommandSuggestions.length - 1, selectedSlashCommandIndex + 1),
    };
  }
  if (key.escape) {
    return { type: "close" };
  }
  if (key.return || inputChar === "\r" || inputChar === "\n") {
    const selected = slashCommandSuggestions[selectedSlashCommandIndex] ?? slashCommandSuggestions[0];
    if (selected && shouldUseSelectedSlashCommand(input, selected)) {
      return { type: "execute", command: selected.command };
    }
  }
  return null;
}

function matchesSlashCommandTokens(inputTokens: string[], command: string): boolean {
  if (inputTokens.length === 0) return false;

  const commandTokens = command.toLowerCase().split(/\s+/).filter(Boolean);
  if (inputTokens.length <= commandTokens.length) {
    return inputTokens.every((token, index) => {
      const commandToken = commandTokens[index];
      if (!commandToken) return false;
      return index === inputTokens.length - 1
        ? commandToken.startsWith(token)
        : commandToken === token;
    });
  }

  return commandTokens.every((commandToken, index) => inputTokens[index] === commandToken);
}
