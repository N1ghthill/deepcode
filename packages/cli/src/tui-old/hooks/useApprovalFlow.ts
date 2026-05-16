import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { collectSecretValues, redactText, type ApprovalRequest } from "@deepcode/core";
import type { DeepCodeRuntime } from "../../runtime.js";
import { t } from "../i18n/index.js";

interface UseApprovalFlowReturn {
  approvals: ApprovalRequest[];
  setApprovals: Dispatch<SetStateAction<ApprovalRequest[]>>;
  resolveApproval: (activeRuntime: DeepCodeRuntime, request: ApprovalRequest | undefined, allowed: boolean, scope?: "once" | "session" | "always", callbacks?: ApprovalCallbacks) => void;
}

interface ApprovalCallbacks {
  setNotice: (notice: string) => void;
  setStatus: (status: string) => void;
}

export function useApprovalFlow(): UseApprovalFlowReturn {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  const resolveApproval = useCallback((
    activeRuntime: DeepCodeRuntime,
    request: ApprovalRequest | undefined,
    allowed: boolean,
    scope: "once" | "session" | "always" = "once",
    callbacks?: ApprovalCallbacks,
  ) => {
    if (!request) return;
    activeRuntime.events.emit("approval:decision", {
      requestId: request.id,
      decision: {
        allowed,
        scope: allowed ? scope : undefined,
        reason: allowed
          ? scope === "session"
            ? "Approved for session from TUI"
            : scope === "always"
              ? "Approved permanently from TUI"
              : "Approved from TUI"
          : "Denied from TUI",
      },
    });
    setApprovals((current) => current.filter((item) => item.id !== request.id));
    if (callbacks) {
      callbacks.setStatus(allowed ? "executing" : "denied");
      const label = allowed
        ? scope === "session" ? t("approvedSession") : scope === "always" ? t("approvedAlways") : t("approved")
        : t("denied");
      callbacks.setNotice(
        `${label}: ${redactText(request.operation, collectSecretValues(activeRuntime.config))}`,
      );
    }
  }, []);

  return { approvals, setApprovals, resolveApproval };
}
