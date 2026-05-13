import { useInput } from "ink";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { Session } from "@deepcode/shared";
import { useAgentStore } from "../store/agent-store.js";
import { getSlashMenuAction, isSlashCommandInput } from "../app-utils.js";
import { t } from "../i18n/index.js";

interface UseChatInputOptions {
  isActive: boolean;
  runtime: DeepCodeRuntime | null;
  session: Session | null;
  showSlashMenu: boolean;
  slashCommandSuggestions: Array<{ command: string; label: string; description: string }>;
  onSubmit: (prompt: string) => void;
  onCommand: (command: string) => void;
}

export function useChatInput({
  isActive,
  runtime,
  session,
  showSlashMenu,
  slashCommandSuggestions,
  onSubmit,
  onCommand,
}: UseChatInputOptions) {
  const input = useAgentStore((s) => s.input);
  const streaming = useAgentStore((s) => s.streaming);
  const vimMode = useAgentStore((s) => s.vimMode);
  const history = useAgentStore((s) => s.history);
  const historyIndex = useAgentStore((s) => s.historyIndex);
  const showInputPreview = useAgentStore((s) => s.showInputPreview);
  const selectedSlashCommandIndex = useAgentStore((s) => s.selectedSlashCommandIndex);

  const setInput = useAgentStore((s) => s.setInput);
  const setVimMode = useAgentStore((s) => s.setVimMode);
  const setNotice = useAgentStore((s) => s.setNotice);
  const setHistoryIndex = useAgentStore((s) => s.setHistoryIndex);
  const setSelectedSlashCommandIndex = useAgentStore((s) => s.setSelectedSlashCommandIndex);
  const setSlashMenuDismissed = useAgentStore((s) => s.setSlashMenuDismissed);

  useInput(
    (inputChar, key) => {
      if (!runtime || !session) return;
      if (streaming) return;

      // Vim normal mode — only handle mode transitions and input editing
      if (vimMode === "normal") {
        if (inputChar === "i" || inputChar === "a") {
          setVimMode("insert");
          return;
        }
        if (inputChar === "A") {
          // Append at end: switch to insert keeping existing input
          setVimMode("insert");
          return;
        }
        if (inputChar === "d" || inputChar === "D") {
          // dd / D — clear input
          setInput("");
          setNotice("Input cleared");
          return;
        }
        if (inputChar === "0") {
          // Go to start of line (clear and re-enter)
          setInput("");
          return;
        }
        if (key.escape) {
          setVimMode("normal");
          return;
        }
        // All other keys (j/k/G/gg/Ctrl+d/Ctrl+u) are handled by useVirtualScroll
        return;
      }

      // Insert mode: escape → normal
      if (vimMode === "insert" && key.escape && !showSlashMenu) {
        setVimMode("normal");
        setNotice(
          input.trim().length === 0
            ? t("normalModeActiveInsert")
            : t("normalModeActiveContinueEditing"),
        );
        return;
      }

      // Slash menu actions
      const slashMenuAction = getSlashMenuAction({
        showSlashMenu,
        slashCommandSuggestions,
        selectedSlashCommandIndex,
        input,
        inputChar,
        key,
      });
      if (slashMenuAction) {
        if (slashMenuAction.type === "move") {
          setSelectedSlashCommandIndex(slashMenuAction.selectedIndex);
        } else if (slashMenuAction.type === "close") {
          setSlashMenuDismissed(true);
        } else if (slashMenuAction.type === "complete") {
          setInput(slashMenuAction.command);
          setSlashMenuDismissed(true);
        } else {
          setInput("");
          onCommand(slashMenuAction.command);
        }
        return;
      }

      // Submit
      if (key.return || inputChar === "\r" || inputChar === "\n") {
        const trimmedInput = input.trim();
        if (isSlashCommandInput(trimmedInput)) {
          onSubmit(trimmedInput);
          return;
        }
        if (!showInputPreview) {
          onSubmit(input.trim());
          return;
        }
        return;
      }

      // Preview input confirmation
      if (key.ctrl && inputChar === "y" && showInputPreview) {
        return;
      }

      // History navigation
      if (key.upArrow) {
        if (history.length === 0) return;
        const nextIndex =
          historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex] ?? "");
        return;
      }
      if (key.downArrow) {
        if (historyIndex === null) return;
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(null);
          setInput("");
        } else {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex] ?? "");
        }
        return;
      }

      // Backspace and regular characters are handled by ink-text-input via onChange.
      // Adding fallbacks here would double-apply the input.
    },
    { isActive },
  );
}
