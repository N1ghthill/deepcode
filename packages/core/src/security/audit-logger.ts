import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { nowIso } from "@deepcode/shared";
import { redactSecrets } from "./secret-redactor.js";

export interface AuditEntry {
  operation: string;
  result: "allowed" | "denied" | "approved" | "failed";
  path?: string;
  reason?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
}

export class AuditLogger {
  constructor(private readonly worktree: string) {}

  async log(entry: AuditEntry): Promise<void> {
    const dir = path.join(this.worktree, ".deepcode");
    await mkdir(dir, { recursive: true });
    const payload = redactSecrets({ ...entry, createdAt: entry.createdAt ?? nowIso() });
    await appendFile(path.join(dir, "audit.log"), `${JSON.stringify(payload)}\n`, "utf8");
  }
}
