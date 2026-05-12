import { randomBytes } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix = "id"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}