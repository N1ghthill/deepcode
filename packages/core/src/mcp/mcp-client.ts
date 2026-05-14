import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class McpClient {
  private readonly process: ChildProcess;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();

  constructor(command: string, args: string[], env?: Record<string, string>) {
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    const rejectAll = (error: Error) => {
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
    };
    this.process.on("error", (err) => rejectAll(err));
    this.process.on("exit", (code) => {
      if (this.pending.size > 0) {
        rejectAll(new Error(`MCP server exited unexpectedly (code ${code ?? "null"})`));
      }
    });

    const rl = createInterface({ input: this.process.stdout!, terminal: false });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        if (msg.id === undefined) return; // notification
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          pending.resolve(msg.result);
        }
      } catch {
        // ignore malformed lines
      }
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "deepcode", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
  }

  async listTools(): Promise<McpTool[]> {
    const result = (await this.request("tools/list")) as { tools?: McpTool[] };
    return result.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const text = result.content.map((c) => c.text ?? "").join("");
    if (result.isError) {
      throw new Error(`MCP tool error: ${text}`);
    }
    return text;
  }

  stop(): void {
    this.process.kill();
    for (const { reject } of this.pending.values()) {
      reject(new Error("MCP client stopped"));
    }
    this.pending.clear();
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
      this.process.stdin!.write(JSON.stringify(msg) + "\n");
    });
  }

  private notify(method: string, params?: unknown): void {
    const msg: JsonRpcRequest = { jsonrpc: "2.0", method, params };
    this.process.stdin!.write(JSON.stringify(msg) + "\n");
  }
}
