/**
 * BackgroundTaskView context — DeepCode stub.
 *
 * Qwen Code's background-task overlay (subagent/shell roster dialog) is not
 * part of DeepCode's feature set. This stub keeps ported components compiling
 * with an always-empty, always-closed roster.
 */

import type { ReactNode } from "react";

export type BackgroundDialogMode = "closed" | "list" | "detail";

export interface BackgroundTaskViewState {
  entries: readonly unknown[];
  selectedIndex: number;
  dialogMode: BackgroundDialogMode;
  dialogOpen: boolean;
  pillFocused: boolean;
}

export interface BackgroundTaskViewActions {
  openDialog(): void;
  closeDialog(): void;
  setPillFocused(focused: boolean): void;
}

const STATE: BackgroundTaskViewState = {
  entries: [],
  selectedIndex: 0,
  dialogMode: "closed",
  dialogOpen: false,
  pillFocused: false,
};

const ACTIONS: BackgroundTaskViewActions = {
  openDialog: () => {},
  closeDialog: () => {},
  setPillFocused: () => {},
};

export function useBackgroundTaskViewState(): BackgroundTaskViewState {
  return STATE;
}

export function useBackgroundTaskViewActions(): BackgroundTaskViewActions {
  return ACTIONS;
}

export function BackgroundTaskViewProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
