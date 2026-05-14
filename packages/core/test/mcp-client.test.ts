import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { McpClient } from "../src/mcp/mcp-client.js";
import { McpManager } from "../src/mcp/mcp-manager.js";

const MOCK_SERVER = `
import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  if (msg.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1.0.0" } } }) + "\\n");
  } else if (msg.method === "tools/list") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo", description: "Echoes the message", inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } }] } }) + "\\n");
  } else if (msg.method === "tools/call" && msg.params?.name === "echo") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "echo: " + msg.params.arguments.message }], isError: false } }) + "\\n");
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } }) + "\\n");
  }
});
`;

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("McpClient", () => {
  it("initializes, lists tools, and calls a tool", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-mcp-"));
    const serverPath = path.join(tempDir, "server.mjs");
    await writeFile(serverPath, MOCK_SERVER, "utf8");

    const client = new McpClient("node", [serverPath]);
    try {
      await client.initialize();

      const tools = await client.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe("echo");
      expect(tools[0]?.description).toBe("Echoes the message");

      const result = await client.callTool("echo", { message: "hello" });
      expect(result).toBe("echo: hello");
    } finally {
      client.stop();
    }
  });

  it("rejects when the tool returns isError", async () => {
    const errorServer = MOCK_SERVER.replace(
      "isError: false",
      "isError: true",
    );
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-mcp-"));
    const serverPath = path.join(tempDir, "server.mjs");
    await writeFile(serverPath, errorServer, "utf8");

    const client = new McpClient("node", [serverPath]);
    try {
      await client.initialize();
      await expect(client.callTool("echo", { message: "bad" })).rejects.toThrow("MCP tool error");
    } finally {
      client.stop();
    }
  });
});

describe("McpManager", () => {
  it("connects to a server and exposes its tools with a qualified name", async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "deepcode-mcp-"));
    const serverPath = path.join(tempDir, "server.mjs");
    await writeFile(serverPath, MOCK_SERVER, "utf8");

    const manager = new McpManager();
    try {
      const tools = await manager.connect([
        { name: "myserver", command: "node", args: [serverPath] },
      ]);

      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe("myserver__echo");
      expect(tools[0]?.description).toBe("Echoes the message");
    } finally {
      manager.stop();
    }
  });

  it("emits app:warn and continues when a server fails to connect", async () => {
    const { EventBus } = await import("../src/events/event-bus.js");
    const events = new EventBus();
    const warnings: string[] = [];
    events.on("app:warn", ({ message }) => { warnings.push(message); });

    const manager = new McpManager(events);
    const tools = await manager.connect([
      { name: "bad", command: "node", args: ["/nonexistent/server.mjs"] },
    ]);

    expect(tools).toHaveLength(0);
    expect(warnings.some((m) => m.includes("bad"))).toBe(true);

    manager.stop();
  });
});
