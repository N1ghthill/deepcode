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
  const setShowInputPreview = useAgentStore((s) => s.setShowInputPreview);
  const setPendingInput = useAgentStore((s) => s.setPendingInput);

  useInput(
    (inputChar, key) => {
      if (!runtime || !session) return;
      if (streaming) return;

      // Vim mode toggle
      if (vimMode === "normal") {
        if (inputChar?.toLowerCase() === "i" || inputChar?.toLowerCase() === "a") {
          setVimMode("insert");
          return;
        }
        if (key.escape) {
          setVimMode("normal");
          return;
        }
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
          setInput("");
          setNotice(t("commandCancelled"));
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

      // Backspace (handled by ink-text-input when focused, but fallback here)
      if (key.backspace || key.delete) {
        setInput((current) => current.slice(0, -1));
        return;
      }

      // Regular characters
      if (inputChar && !key.ctrl && !key.meta) {
        setInput((current) => current + inputChar);
      }
    },
    { isActive },
  );
}
