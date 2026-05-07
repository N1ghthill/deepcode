import { EventEmitter } from "node:events";
import type { Activity } from "@deepcode/shared";

export interface ApprovalRequest {
  id: string;
  operation: string;
  level: string;
  path?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface ApprovalDecision {
  allowed: boolean;
  reason?: string;
}

export interface AppEvents {
  "activity": Activity;
  "approval:request": ApprovalRequest;
  "approval:decision": { requestId: string; decision: ApprovalDecision };
  "error": { error: Error; context?: Record<string, unknown> };
}

export class EventBus {
  private readonly emitter = new EventEmitter();

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  once<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): void {
    this.emitter.once(event, listener);
  }
}
