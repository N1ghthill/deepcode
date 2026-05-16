import { t, type I18nKey } from "../i18n/index.js";

const STATUS_KEY_MAP: Record<string, I18nKey | null> = {
  "awaiting approval": "statusAwaitingApproval",
  awaiting_approval: "statusAwaitingApproval",
  cancelled: "statusCancelled",
  executing: "statusExecuting",
  error: "statusError",
  denied: "statusDenied",
  idle: "statusIdle",
  loading: "statusLoading",
  planning: "statusPlanning",
};

export function formatAgentStatus(status: string): string {
  const key = STATUS_KEY_MAP[status];
  return key ? t(key) : status;
}
