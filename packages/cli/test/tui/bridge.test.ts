import { describe, it, expect } from "vitest";
import type { Activity, Message, ToolCall } from "@deepcode/shared";
import {
  mapMessagesToHistoryItems,
  reduceToolActivity,
  resolveSlashInvocation,
} from "../../src/tui/bridge.js";
import { ToolCallStatus, type IndividualToolCallDisplay } from "../../src/tui/ui/types.js";
import { CommandKind, type SlashCommand } from "../../src/tui/ui/commands/types.js";

let seq = 0;
function msg(partial: Partial<Message> & Pick<Message, "role">): Message {
  seq += 1;
  return {
    id: `m-${seq}`,
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function toolCall(id: string, name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id, name, arguments: args };
}

interface ToolGroupItem {
  type: "tool_group";
  tools: IndividualToolCallDisplay[];
}

describe("mapMessagesToHistoryItems", () => {
  it("turns assistant text into a gemini item and skips user messages", () => {
    const items = mapMessagesToHistoryItems([
      msg({ role: "user", content: "hi" }),
      msg({ role: "assistant", content: "hello there" }),
    ]);
    expect(items).toEqual([{ type: "gemini", text: "hello there" }]);
  });

  it("emits a tool_group and patches results by call id", () => {
    const items = mapMessagesToHistoryItems([
      msg({ role: "assistant", content: "", toolCalls: [toolCall("c1", "read_file")] }),
      msg({ role: "tool", toolCallId: "c1", content: "file contents" }),
    ]);
    expect(items).toHaveLength(1);
    const group = items[0] as ToolGroupItem;
    expect(group.type).toBe("tool_group");
    expect(group.tools[0]?.status).toBe(ToolCallStatus.Success);
    expect(group.tools[0]?.resultDisplay).toBe("file contents");
  });

  it("marks a tool result starting with Error as failed", () => {
    const items = mapMessagesToHistoryItems([
      msg({ role: "assistant", content: "", toolCalls: [toolCall("c1", "shell")] }),
      msg({ role: "tool", toolCallId: "c1", content: "Error: command failed" }),
    ]);
    expect((items[0] as ToolGroupItem).tools[0]?.status).toBe(ToolCallStatus.Error);
  });

  it("forces unfinished tools to Success by default", () => {
    const items = mapMessagesToHistoryItems([
      msg({ role: "assistant", content: "", toolCalls: [toolCall("c1", "read_file")] }),
    ]);
    expect((items[0] as ToolGroupItem).tools[0]?.status).toBe(ToolCallStatus.Success);
  });

  it("marks unfinished tools as Canceled when aborted", () => {
    const items = mapMessagesToHistoryItems(
      [msg({ role: "assistant", content: "", toolCalls: [toolCall("c1", "read_file")] })],
      { aborted: true },
    );
    const tool = (items[0] as ToolGroupItem).tools[0];
    expect(tool?.status).toBe(ToolCallStatus.Canceled);
    expect(tool?.resultDisplay).toBe("Cancelled.");
  });

  it("preserves ordering across multiple rounds", () => {
    const items = mapMessagesToHistoryItems([
      msg({ role: "assistant", content: "round one", toolCalls: [toolCall("c1", "read_file")] }),
      msg({ role: "tool", toolCallId: "c1", content: "ok" }),
      msg({ role: "assistant", content: "round two" }),
    ]);
    expect(items.map((item) => item.type)).toEqual(["gemini", "tool_group", "gemini"]);
  });
});

describe("reduceToolActivity", () => {
  function activity(type: string, metadata?: Record<string, unknown>): Activity {
    return {
      id: "a-1",
      type,
      message: `${type} event`,
      metadata,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("appends an executing entry on tool_call", () => {
    const next = reduceToolActivity(
      [],
      activity("tool_call", { tool: "read_file", args: { path: "a" } }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.name).toBe("read_file");
    expect(next[0]?.status).toBe(ToolCallStatus.Executing);
  });

  it("resolves the oldest executing entry on tool_result", () => {
    const start = reduceToolActivity([], activity("tool_call", { tool: "shell" }));
    const done = reduceToolActivity(start, activity("tool_result", { tool: "shell", result: "done" }));
    expect(done[0]?.status).toBe(ToolCallStatus.Success);
    expect(done[0]?.resultDisplay).toBe("done");
  });

  it("marks the entry as Error on tool_error", () => {
    const start = reduceToolActivity([], activity("tool_call", { tool: "shell" }));
    const failed = reduceToolActivity(start, activity("tool_error", { tool: "shell", error: "boom" }));
    expect(failed[0]?.status).toBe(ToolCallStatus.Error);
    expect(failed[0]?.resultDisplay).toBe("boom");
  });

  it("ignores non-tool activities", () => {
    const prev: IndividualToolCallDisplay[] = [];
    expect(reduceToolActivity(prev, activity("info"))).toBe(prev);
  });

  it("ignores a result with no matching executing entry", () => {
    const prev: IndividualToolCallDisplay[] = [];
    expect(reduceToolActivity(prev, activity("tool_result", { tool: "shell", result: "x" }))).toBe(
      prev,
    );
  });
});

describe("resolveSlashInvocation", () => {
  const cmd = (name: string, extra: Partial<SlashCommand> = {}): SlashCommand => ({
    name,
    description: name,
    kind: CommandKind.BUILT_IN,
    ...extra,
  });
  const commands: SlashCommand[] = [cmd("help"), cmd("auth", { altNames: ["login"] }), cmd("model")];

  it("resolves a plain command", () => {
    const result = resolveSlashInvocation("/help", commands);
    expect(result?.command.name).toBe("help");
    expect(result?.args).toBe("");
  });

  it("matches alt names case-insensitively", () => {
    expect(resolveSlashInvocation("/LOGIN", commands)?.command.name).toBe("auth");
  });

  it("extracts the argument string", () => {
    const result = resolveSlashInvocation("/model claude-opus-4-7", commands);
    expect(result?.command.name).toBe("model");
    expect(result?.args).toBe("claude-opus-4-7");
  });

  it("returns null for an unknown command", () => {
    expect(resolveSlashInvocation("/nope", commands)).toBeNull();
  });

  it("walks into sub-commands", () => {
    const withSub: SlashCommand[] = [cmd("memory", { subCommands: [cmd("add"), cmd("list")] })];
    const result = resolveSlashInvocation("/memory add some note", withSub);
    expect(result?.command.name).toBe("add");
    expect(result?.name).toBe("memory add");
    expect(result?.args).toBe("some note");
  });
});
