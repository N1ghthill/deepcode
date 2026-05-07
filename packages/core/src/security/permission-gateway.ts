import { createId, nowIso, type DeepCodeConfig, type PermissionMode } from "@deepcode/shared";
import { PermissionDeniedError } from "../errors.js";
import type { ApprovalDecision, ApprovalRequest, EventBus } from "../events/event-bus.js";
import type { AuditLogger } from "./audit-logger.js";
import type { PathSecurity } from "./path-security.js";

export type OperationKind = "read" | "write" | "git_local" | "shell" | "dangerous";

export interface PermissionCheck {
  operation: string;
  kind: OperationKind;
  path?: string;
  details?: Record<string, unknown>;
}

export class PermissionGateway {
  constructor(
    private readonly config: DeepCodeConfig,
    private readonly pathSecurity: PathSecurity,
    private readonly audit: AuditLogger,
    private readonly eventBus: EventBus,
    private readonly interactive = false,
  ) {}

  async ensure(check: PermissionCheck): Promise<void> {
    const decision = await this.check(check);
    if (!decision.allowed) {
      throw new PermissionDeniedError(decision.reason ?? `Operation denied: ${check.operation}`);
    }
  }

  async check(check: PermissionCheck): Promise<ApprovalDecision> {
    if (check.path && !this.pathSecurity.isAllowed(check.path)) {
      await this.audit.log({ operation: check.operation, path: check.path, result: "denied", reason: "path" });
      return { allowed: false, reason: "Path not allowed" };
    }

    const mode = this.resolveMode(check);
    if (mode === "deny") {
      await this.audit.log({ operation: check.operation, path: check.path, result: "denied", reason: "config" });
      return { allowed: false, reason: "Denied by configuration" };
    }

    if (mode === "allow") {
      await this.audit.log({ operation: check.operation, path: check.path, result: "allowed" });
      return { allowed: true };
    }

    if (!this.interactive) {
      await this.audit.log({ operation: check.operation, path: check.path, result: "denied", reason: "non_interactive" });
      return { allowed: false, reason: "Approval required in non-interactive mode" };
    }

    const request: ApprovalRequest = {
      id: createId("approval"),
      operation: check.operation,
      level: check.kind,
      path: check.path,
      details: check.details,
      createdAt: nowIso(),
    };

    this.eventBus.emit("approval:request", request);
    const decision = await new Promise<ApprovalDecision>((resolve) => {
      this.eventBus.once("approval:decision", (payload) => {
        if (payload.requestId === request.id) {
          resolve(payload.decision);
        }
      });
    });

    await this.audit.log({
      operation: check.operation,
      path: check.path,
      result: decision.allowed ? "approved" : "denied",
      reason: decision.reason,
      details: { requestId: request.id },
    });
    return decision;
  }

  private resolveMode(check: PermissionCheck): PermissionMode {
    if (check.kind === "shell" && this.config.permissions.allowShell.includes(check.operation)) {
      return "allow";
    }
    if (check.kind === "read") return this.config.permissions.read;
    if (check.kind === "write") return this.config.permissions.write;
    if (check.kind === "git_local") return this.config.permissions.gitLocal;
    if (check.kind === "shell") return this.config.permissions.shell;
    return this.config.permissions.dangerous;
  }
}
