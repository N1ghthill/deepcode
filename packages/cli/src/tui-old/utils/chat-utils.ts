import type { Message } from "@deepcode/shared";
import type { ModalType, ViewMode, VimMode } from "../types.js";

export function getRenderableChatMessages(messages: Message[]): Message[] {
  return messages.filter((message) => {
    if (message.role === "tool") {
      return false;
    }

    return message.content.trim().length > 0;
  });
}

export function isSidebarHotkeysEnabled({
  viewMode,
  vimMode,
  input,
  activeModal,
  streaming,
  showInputPreview,
  approvalCount,
  oauthActive,
}: {
  viewMode: ViewMode;
  vimMode: VimMode;
  input: string;
  activeModal: ModalType;
  streaming: boolean;
  showInputPreview: boolean;
  approvalCount: number;
  oauthActive: boolean;
}): boolean {
  if (activeModal || streaming || showInputPreview || approvalCount > 0 || oauthActive) {
    return false;
  }

  if (viewMode !== "chat" || vimMode !== "insert") {
    return true;
  }

  return input.trim().length === 0;
}
