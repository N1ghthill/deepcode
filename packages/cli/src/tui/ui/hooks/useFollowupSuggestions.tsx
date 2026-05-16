/**
 * Followup-suggestions hook — DeepCode stub.
 *
 * Qwen Code speculatively suggests a next prompt after each turn. DeepCode does
 * not ship this; the stub reports "no suggestion" so the followup branches in
 * the ported InputPrompt stay inert.
 */

import type { Config } from "@deepcode/tui-shim";

export interface FollowupState {
  isVisible: boolean;
  suggestion: string | null;
}

export interface UseFollowupSuggestionsOptions {
  enabled?: boolean;
  onAccept?: (suggestion: string) => void;
  config?: Config;
  isFocused?: boolean;
}

export interface UseFollowupSuggestionsReturn {
  state: FollowupState;
  setSuggestion: (text: string | null) => void;
  accept: (
    method?: "tab" | "enter" | "right",
    options?: { skipOnAccept?: boolean },
  ) => void;
  dismiss: () => void;
  clear: () => void;
  recordKeystroke: () => void;
}

const INERT: UseFollowupSuggestionsReturn = {
  state: { isVisible: false, suggestion: null },
  setSuggestion: () => {},
  accept: () => {},
  dismiss: () => {},
  clear: () => {},
  recordKeystroke: () => {},
};

export function useFollowupSuggestionsCLI(
  _options?: UseFollowupSuggestionsOptions,
): UseFollowupSuggestionsReturn {
  return INERT;
}
