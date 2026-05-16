import { useInput } from "ink";
import { useRef } from "react";
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

// --- cursor helpers ---

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function findNextWordStart(text: string, pos: number): number {
  let i = pos + 1;
  // skip current word chars
  while (i < text.length && /\S/.test(text[i]!)) i++;
  // skip whitespace
  while (i < text.length && /\s/.test(text[i]!)) i++;
  return Math.min(i, text.length - 1 < 0 ? 0 : text.length - 1);
}

function findPrevWordStart(text: string, pos: number): number {
  let i = pos - 1;
  // skip whitespace
  while (i > 0 && /\s/.test(text[i]!)) i--;
  // skip word chars
  while (i > 0 && /\S/.test(text[i - 1]!)) i--;
  return Math.max(0, i);
}

function findWordEnd(text: string, pos: number): number {
  let i = pos + 1;
  // skip whitespace
  while (i < text.length - 1 && /\s/.test(text[i]!)) i++;
  // advance to end of word
  while (i < text.length - 1 && /\S/.test(text[i + 1]!)) i++;
  return Math.min(i, text.length > 0 ? text.length - 1 : 0);
}

function maxCursorPos(text: string): number {
  return Math.max(0, text.length - 1);
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
  const cursorOffset = useAgentStore((s) => s.cursorOffset);
  const history = useAgentStore((s) => s.history);
  const historyIndex = useAgentStore((s) => s.historyIndex);
  const showInputPreview = useAgentStore((s) => s.showInputPreview);
  const selectedSlashCommandIndex = useAgentStore((s) => s.selectedSlashCommandIndex);

  const setInput = useAgentStore((s) => s.setInput);
  const setVimMode = useAgentStore((s) => s.setVimMode);
  const setCursorOffset = useAgentStore((s) => s.setCursorOffset);
  const setNotice = useAgentStore((s) => s.setNotice);
  const setHistoryIndex = useAgentStore((s) => s.setHistoryIndex);
  const setSelectedSlashCommandIndex = useAgentStore((s) => s.setSelectedSlashCommandIndex);
  const setSlashMenuDismissed = useAgentStore((s) => s.setSlashMenuDismissed);

  // pending operator for multi-key sequences (r<char>, c, etc.)
  const pendingOp = useRef<string | null>(null);

  useInput(
    (inputChar, key) => {
      if (!runtime || !session) return;
      if (streaming) return;

      // Vim normal mode
      if (vimMode === "normal") {
        if (key.escape) {
          pendingOp.current = null;
          return;
        }

        // --- pending operator resolution ---
        if (pendingOp.current === "r") {
          // replace char at cursor
          if (inputChar && !key.ctrl && !key.meta) {
            const arr = input.split("");
            arr[cursorOffset] = inputChar;
            setInput(arr.join(""));
          }
          pendingOp.current = null;
          return;
        }

        if (pendingOp.current === "c") {
          if (inputChar === "c") {
            // cc — clear all + insert
            setInput("");
            setCursorOffset(0);
            setVimMode("insert");
            pendingOp.current = null;
            return;
          }
          if (inputChar === "w") {
            // cw — delete to next word start, enter insert
            const wordEnd = findNextWordStart(input, cursorOffset);
            const newText = input.slice(0, cursorOffset) + input.slice(wordEnd);
            setInput(newText);
            setCursorOffset(clamp(cursorOffset, 0, maxCursorPos(newText)));
            setVimMode("insert");
            pendingOp.current = null;
            return;
          }
          if (inputChar === "b") {
            // cb — delete to prev word start, enter insert
            const wordStart = findPrevWordStart(input, cursorOffset);
            const newText = input.slice(0, wordStart) + input.slice(cursorOffset);
            setInput(newText);
            setCursorOffset(wordStart);
            setVimMode("insert");
            pendingOp.current = null;
            return;
          }
          pendingOp.current = null;
          return;
        }

        if (pendingOp.current === "d") {
          if (inputChar === "d") {
            // dd — clear all
            setInput("");
            setCursorOffset(0);
            setNotice("Input cleared");
            pendingOp.current = null;
            return;
          }
          if (inputChar === "w") {
            // dw — delete word
            const wordEnd = findNextWordStart(input, cursorOffset);
            const newText = input.slice(0, cursorOffset) + input.slice(wordEnd);
            setInput(newText);
            setCursorOffset(clamp(cursorOffset, 0, maxCursorPos(newText)));
            pendingOp.current = null;
            return;
          }
          pendingOp.current = null;
          return;
        }

        // --- motion & action keys ---

        // Enter insert mode
        if (inputChar === "i") {
          setVimMode("insert");
          return;
        }
        if (inputChar === "a") {
          // append after cursor
          const newOffset = Math.min(cursorOffset + 1, input.length);
          setCursorOffset(newOffset);
          setVimMode("insert");
          return;
        }
        if (inputChar === "A") {
          setCursorOffset(input.length);
          setVimMode("insert");
          return;
        }
        if (inputChar === "I") {
          setCursorOffset(0);
          setVimMode("insert");
          return;
        }
        if (inputChar === "S") {
          // clear all + insert
          setInput("");
          setCursorOffset(0);
          setVimMode("insert");
          return;
        }

        // Cursor movement
        if (inputChar === "h" || key.leftArrow) {
          setCursorOffset(clamp(cursorOffset - 1, 0, maxCursorPos(input)));
          return;
        }
        if (inputChar === "l" || key.rightArrow) {
          setCursorOffset(clamp(cursorOffset + 1, 0, maxCursorPos(input)));
          return;
        }
        if (inputChar === "0") {
          setCursorOffset(0);
          return;
        }
        if (inputChar === "$") {
          setCursorOffset(maxCursorPos(input));
          return;
        }
        if (inputChar === "^") {
          // first non-blank
          const firstNonBlank = input.search(/\S/);
          setCursorOffset(firstNonBlank >= 0 ? firstNonBlank : 0);
          return;
        }

        // Word motions
        if (inputChar === "w") {
          setCursorOffset(findNextWordStart(input, cursorOffset));
          return;
        }
        if (inputChar === "b") {
          setCursorOffset(findPrevWordStart(input, cursorOffset));
          return;
        }
        if (inputChar === "e") {
          setCursorOffset(findWordEnd(input, cursorOffset));
          return;
        }

        // Delete
        if (inputChar === "x") {
          if (input.length === 0) return;
          const newText = input.slice(0, cursorOffset) + input.slice(cursorOffset + 1);
          setInput(newText);
          setCursorOffset(clamp(cursorOffset, 0, maxCursorPos(newText)));
          return;
        }
        if (inputChar === "X") {
          if (cursorOffset === 0 || input.length === 0) return;
          const newText = input.slice(0, cursorOffset - 1) + input.slice(cursorOffset);
          setInput(newText);
          setCursorOffset(clamp(cursorOffset - 1, 0, maxCursorPos(newText)));
          return;
        }
        if (inputChar === "D") {
          // delete to end of line
          const newText = input.slice(0, cursorOffset);
          setInput(newText);
          setCursorOffset(clamp(cursorOffset, 0, maxCursorPos(newText)));
          return;
        }
        if (inputChar === "C") {
          // change to end of line
          const newText = input.slice(0, cursorOffset);
          setInput(newText);
          setCursorOffset(clamp(cursorOffset, 0, maxCursorPos(newText)));
          setVimMode("insert");
          return;
        }

        // Pending operators
        if (inputChar === "r") {
          pendingOp.current = "r";
          return;
        }
        if (inputChar === "c") {
          pendingOp.current = "c";
          return;
        }
        if (inputChar === "d") {
          pendingOp.current = "d";
          return;
        }

        // All other keys (j/k/G/gg/Ctrl+d/Ctrl+u) handled by useVirtualScroll
        return;
      }

      // Insert mode: escape → normal
      if (vimMode === "insert" && key.escape && !showSlashMenu) {
        setVimMode("normal");
        // place cursor at last char (vim behaviour: back one on escape)
        setCursorOffset(maxCursorPos(input));
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
