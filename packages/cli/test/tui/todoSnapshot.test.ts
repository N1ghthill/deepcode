import { describe, it, expect } from "vitest";
import {
  getStickyTodos,
  getOrderedStickyTodos,
  getStickyTodoMaxVisibleItems,
  STICKY_TODO_MAX_VISIBLE_ITEMS,
} from "../../src/tui/utils/todoSnapshot.js";
import type { HistoryItem } from "../../src/tui/ui/types.js";
import type { TodoItem } from "../../src/tui/ui/components/TodoDisplay.js";

// ── helpers ─────────────────────────────────────────────────────────────────

function todo(id: string, status: TodoItem["status"]): TodoItem {
  return { id, content: `Task ${id}`, status };
}

function toolGroupWithTodos(todos: TodoItem[], id = "g1"): HistoryItem {
  return {
    id: 1,
    type: "tool_group",
    tools: [
      {
        callId: id,
        name: "TodoWrite",
        description: "Write todos",
        status: "success",
        confirmationDetails: undefined,
        resultDisplay: { type: "todo_list", todos },
      },
    ],
  } as unknown as HistoryItem;
}

function toolGroupNoTodos(id = "g0"): HistoryItem {
  return {
    id: 2,
    type: "tool_group",
    tools: [
      {
        callId: id,
        name: "ReadFile",
        description: "Read a file",
        status: "success",
        confirmationDetails: undefined,
        resultDisplay: "some text output",
      },
    ],
  } as unknown as HistoryItem;
}

function infoItem(id: number): HistoryItem {
  return { id, type: "info", text: "info" } as HistoryItem;
}

// ── getStickyTodos ───────────────────────────────────────────────────────────

describe("getStickyTodos", () => {
  it("returns null when history is empty", () => {
    expect(getStickyTodos([], [])).toBeNull();
  });

  it("returns null when there are no tool_group items", () => {
    const history = [infoItem(1), infoItem(2), infoItem(3)];
    expect(getStickyTodos(history, [])).toBeNull();
  });

  it("returns null when the todo snapshot has no items after it (not yet sticky)", () => {
    // Only 1 item after the snapshot (need ≥ 2)
    const history = [toolGroupWithTodos([todo("t1", "pending")]), infoItem(10)];
    expect(getStickyTodos(history, [])).toBeNull();
  });

  it("returns todos when snapshot has ≥ 2 items after it", () => {
    const todos = [todo("t1", "pending"), todo("t2", "in_progress")];
    const history = [toolGroupWithTodos(todos), infoItem(10), infoItem(11)];
    expect(getStickyTodos(history, [])).toEqual(todos);
  });

  it("returns null when all todos are completed", () => {
    const todos = [todo("t1", "completed"), todo("t2", "completed")];
    const history = [toolGroupWithTodos(todos), infoItem(10), infoItem(11)];
    expect(getStickyTodos(history, [])).toBeNull();
  });

  it("returns null when a pending snapshot exists in pendingHistoryItems", () => {
    const todos = [todo("t1", "pending")];
    const history = [toolGroupWithTodos(todos), infoItem(10), infoItem(11)];
    const pending = [toolGroupWithTodos([todo("t2", "in_progress")])] as never;
    expect(getStickyTodos(history, pending)).toBeNull();
  });

  it("uses the LATEST tool_group snapshot when multiple exist", () => {
    const old = [todo("old1", "pending")];
    const latest = [todo("new1", "in_progress")];
    // latest snapshot is last → only 1 item after it → not sticky yet
    const history = [
      toolGroupWithTodos(old),
      infoItem(10),
      infoItem(11),
      toolGroupWithTodos(latest),
      infoItem(12),
    ];
    // 1 item after latest snapshot — not sticky
    expect(getStickyTodos(history, [])).toBeNull();
  });

  it("returns null when the latest snapshot has an empty todos array", () => {
    const history = [toolGroupWithTodos([]), infoItem(10), infoItem(11)];
    expect(getStickyTodos(history, [])).toBeNull();
  });

  it("ignores tool_group items without a todo_list result", () => {
    const history = [toolGroupNoTodos(), infoItem(10), infoItem(11)];
    expect(getStickyTodos(history, [])).toBeNull();
  });
});

// ── getOrderedStickyTodos ────────────────────────────────────────────────────

describe("getOrderedStickyTodos", () => {
  it("returns an empty array unchanged", () => {
    expect(getOrderedStickyTodos([])).toEqual([]);
  });

  it("sorts in_progress first, then pending, then completed", () => {
    const todos: TodoItem[] = [
      todo("a", "completed"),
      todo("b", "pending"),
      todo("c", "in_progress"),
    ];
    const result = getOrderedStickyTodos(todos);
    expect(result.map((t) => t.status)).toEqual([
      "in_progress",
      "pending",
      "completed",
    ]);
  });

  it("preserves original order within the same status", () => {
    const todos: TodoItem[] = [
      todo("a", "pending"),
      todo("b", "in_progress"),
      todo("c", "pending"),
      todo("d", "in_progress"),
    ];
    const result = getOrderedStickyTodos(todos);
    const inProgress = result.filter((t) => t.status === "in_progress").map((t) => t.id);
    const pending = result.filter((t) => t.status === "pending").map((t) => t.id);
    expect(inProgress).toEqual(["b", "d"]);
    expect(pending).toEqual(["a", "c"]);
  });

  it("does not mutate the original array", () => {
    const todos: TodoItem[] = [todo("a", "completed"), todo("b", "pending")];
    const copy = [...todos];
    getOrderedStickyTodos(todos);
    expect(todos).toEqual(copy);
  });
});

// ── getStickyTodoMaxVisibleItems ─────────────────────────────────────────────

describe("getStickyTodoMaxVisibleItems", () => {
  it("returns the default max for very tall terminals", () => {
    expect(getStickyTodoMaxVisibleItems(1000)).toBe(STICKY_TODO_MAX_VISIBLE_ITEMS);
  });

  it("returns 1 for very short terminals", () => {
    expect(getStickyTodoMaxVisibleItems(5)).toBe(1);
  });

  it("returns the default max for non-finite or zero height", () => {
    expect(getStickyTodoMaxVisibleItems(0)).toBe(STICKY_TODO_MAX_VISIBLE_ITEMS);
    expect(getStickyTodoMaxVisibleItems(Infinity)).toBe(STICKY_TODO_MAX_VISIBLE_ITEMS);
    expect(getStickyTodoMaxVisibleItems(-1)).toBe(STICKY_TODO_MAX_VISIBLE_ITEMS);
  });

  it("scales linearly with terminal height (5 rows per item)", () => {
    // 25 rows / 5 rows_per_item = 5 items → capped at STICKY_TODO_MAX_VISIBLE_ITEMS
    expect(getStickyTodoMaxVisibleItems(25)).toBe(STICKY_TODO_MAX_VISIBLE_ITEMS);
    // 15 rows / 5 = 3 items
    expect(getStickyTodoMaxVisibleItems(15)).toBe(3);
    // 10 rows / 5 = 2 items
    expect(getStickyTodoMaxVisibleItems(10)).toBe(2);
  });
});
