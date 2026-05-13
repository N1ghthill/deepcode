import { useInput } from "ink";
import type { DeepCodeRuntime } from "../../runtime.js";
import type { ApprovalRequest } from "@deepcode/core";
import { useAgentStore } from "../store/agent-store.js";
import { t } from "../i18n/index.js";

interface UseSessionInputOptions {
  isActive: boolean;
  runtime: DeepCodeRuntime | null;
  onSwitchSession: (sessionIndex: number, runtime: DeepCodeRuntime) => void;
  onClearApprovals: () => void;
}

export function useSessionInput({
  isActive,
  runtime,
  onSwitchSession,
  onClearApprovals,
}: UseSessionInputOptions) {
  const selectedSessionIndex = useAgentStore((s) => s.selectedSessionIndex);
  const setSelectedSessionIndex = useAgentStore((s) => s.setSelectedSessionIndex);
  const setViewMode = useAgentStore((s) => s.setViewMode);
  const setVimMode = useAgentStore((s) => s.setVimMode);
  const setNotice = useAgentStore((s) => s.setNotice);

  useInput(
    (inputChar, key) => {
      if (!runtime) return;
      const sessionList = runtime.sessions.list();

      if (key.upArrow) {
        setSelectedSessionIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedSessionIndex((current) =>
          Math.min(Math.max(0, sessionList.length - 1), current + 1),
        );
        return;
      }
      if (key.return) {
        onSwitchSession(selectedSessionIndex, runtime);
        onClearApprovals();
        return;
      }
      if (key.escape) {
        setViewMode("chat");
        setVimMode("insert");
        setNotice(t("chatActive"));
        return;
      }
    },
    { isActive },
  );
}
