import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId, nowIso, SessionSchema, type Message, type ProviderId, type Session } from "@deepcode/shared";

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly worktree: string) {}

  create(input: { provider: ProviderId; model?: string }): Session {
    const now = nowIso();
    const session: Session = {
      id: createId("session"),
      worktree: this.worktree,
      provider: input.provider,
      model: input.model,
      status: "idle",
      messages: [],
      activities: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    return session;
  }

  save(session: Session): void {
    this.sessions.set(session.id, { ...session, updatedAt: nowIso() });
  }

  addMessage(sessionId: string, message: Omit<Message, "id" | "createdAt">): Message {
    const session = this.get(sessionId);
    const full: Message = { ...message, id: createId("msg"), createdAt: nowIso() };
    session.messages.push(full);
    session.updatedAt = nowIso();
    this.save(session);
    return full;
  }

  async persist(sessionId: string): Promise<string> {
    const session = this.get(sessionId);
    const dir = path.join(this.worktree, ".deepcode", "sessions");
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${session.id}.json`);
    await writeFile(filePath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
    return filePath;
  }

  async loadAll(): Promise<Session[]> {
    const dir = path.join(this.worktree, ".deepcode", "sessions");
    try {
      const entries = await readdir(dir);
      const loaded = await Promise.all(
        entries
          .filter((entry) => entry.endsWith(".json"))
          .map(async (entry) => SessionSchema.parse(JSON.parse(await readFile(path.join(dir, entry), "utf8")))),
      );
      for (const session of loaded) this.sessions.set(session.id, session);
      return loaded;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
